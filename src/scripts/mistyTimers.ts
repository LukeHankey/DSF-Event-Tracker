import axios from "axios";
import { API_URL, ORIGIN } from "../config";
import { userHasRequiredRole } from "./permissions";
import { showToast } from "./notifications";
import { wsClient } from "./ws";
import { WorldRecord } from "./mistyDialog";

type WorldStatus = "Inactive" | "Active" | "Spawnable" | "Unknown";

interface WorldEventStatusBase {
    world: number;
    status: WorldStatus;
    last_update_timestamp: number;
}

interface ActiveWorldEventStatus extends WorldEventStatusBase {
    status: "Active";
    event: string;
    active_time: number;
    job_id: string;
    event_record: string;
}

interface InactiveWorldEventStatus extends WorldEventStatusBase {
    status: "Inactive";
    inactive_time: number;
}

interface SpawnableWorldEventStatus extends WorldEventStatusBase {
    status: "Spawnable";
    inactive_time: number;
}

interface UnknownWorldEventStatus extends WorldEventStatusBase {
    status: "Unknown";
}

export type WorldEventStatus =
    | ActiveWorldEventStatus
    | InactiveWorldEventStatus
    | SpawnableWorldEventStatus
    | UnknownWorldEventStatus;

type NonActiveWorldEventStatus = Exclude<WorldEventStatus, ActiveWorldEventStatus>;

enum TableColumn {
    // Assuming the first column (index 0) is unused.
    World = 1,
    Status = 2,
    InactiveFor = 3,
}

type TableColumnName = keyof typeof TableColumn;
type TableSortOrder = "asc" | "desc";

export const worldMap = new Map<number, WorldEventStatus>();
const worldsOnDisplay = new Set<number>();
let refreshIntervalMisty: NodeJS.Timeout | null = null;

export async function renderMistyTimers(): Promise<void> {
    try {
        const currentWorldEventsAxios = await axios.get(`${API_URL}/events/current`, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        const currentWorldEvents: WorldEventStatus[] = currentWorldEventsAxios.data.message;
        const tableSort = (localStorage.getItem("tableSort") ?? "World") as TableColumnName;
        const tableSortOrder = (localStorage.getItem("tableSortOrder") ?? "asc") as TableSortOrder;

        for (const currentWorldEvent of currentWorldEvents) {
            worldMap.set(currentWorldEvent.world, currentWorldEvent);
            if (currentWorldEvent.status === "Active") continue;
            await appendEventRow(currentWorldEvent, tableSort, tableSortOrder);
        }
        initTableSorting(tableSort, tableSortOrder);
    } catch (err) {
        console.error(err);
    }
}

export function startMistyimerRefresh(): void {
    if (!refreshIntervalMisty) {
        refreshIntervalMisty = setInterval(() => {
            updateWorldTimers();
        }, 1000);
    }
}

function updateRowTimer(row: HTMLTableRowElement, worldEventStatus: WorldEventStatus, now: number): void {
    const lastUpdate = worldEventStatus.last_update_timestamp;
    const secondsElapsed = (now - lastUpdate) / 1000;
    const cells = row.getElementsByTagName("td");
    const timerCell = cells[3];
    const statusCell = cells[2];

    // If the elapsed time has reached or exceeded 2 hours 16 minutes (8160 seconds)
    if (secondsElapsed >= 8160) {
        // If status hasn't already been updated to "Unknown", update it.
        if (worldEventStatus.status !== "Unknown") {
            const updatedEvent: UnknownWorldEventStatus = {
                world: worldEventStatus.world,
                last_update_timestamp: worldEventStatus.last_update_timestamp,
                status: "Unknown",
            };
            worldMap.set(worldEventStatus.world, updatedEvent);
        }
        // Mark the row as "stopped" to skip further updates.
        row.setAttribute("data-timer-stopped", "true");

        // Freeze the timer cell at 2:16:00
        const fixedTime = formatTimeLeftValueMisty(-1);
        if (timerCell) {
            timerCell.textContent = fixedTime;
        }
        // Update the status cell to "Unknown"
        if (statusCell) {
            statusCell.textContent = "Unknown";
        }
        return;
    }

    // Otherwise, update normally.
    const formattedTime = formatTimeLeftValueMisty(secondsElapsed);
    if (timerCell) {
        timerCell.textContent = formattedTime;
    }
    if (statusCell) {
        statusCell.textContent = worldEventStatus.status;
    }
}

function updateWorldTimers(): void {
    const tbody = document.getElementById("mistyTimerBody");
    if (!tbody) return;
    const now = Date.now();
    const rows = Array.from(tbody.getElementsByTagName("tr"));

    for (const row of rows) {
        // Skip this row if it has already been stopped.
        if (row.getAttribute("data-timer-stopped") === "true") continue;
        if (row.classList.contains("editing")) continue;

        // Assuming the world id is stored as a data attribute on the row.
        const world = Number(row.dataset.world);
        const worldEventStatus = worldMap.get(world);
        if (!worldEventStatus) continue;

        updateRowTimer(row, worldEventStatus, now);
    }
}

function formatTimeLeftValueMisty(seconds: number): string {
    const totalMinutes = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0");

    // If total minutes exceed 59, calculate hours.
    if (totalMinutes > 59) {
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return `${hrs}h ${mins}m ${secs}s`;
    }

    return `${totalMinutes}m ${secs}s`;
}

export async function updateWorld(worldEvent: WorldEventStatus): Promise<void> {
    // Update the stored status for the world.
    worldMap.set(worldEvent.world, worldEvent);
    const tableSort = (localStorage.getItem("tableSort") ?? "World") as TableColumnName;
    const tableSortOrder = (localStorage.getItem("tableSortOrder") ?? "asc") as TableSortOrder;

    if (worldEvent.status === "Active") {
        // If the world is now active, remove its row from the table.
        const tbody = document.getElementById("mistyTimerBody");
        if (tbody) {
            const row = tbody.querySelector(`tr[data-world="${worldEvent.world}"]`);
            if (row) {
                row.remove();
            }
        }
        // Also remove it from the set of displayed worlds.
        worldsOnDisplay.delete(worldEvent.world);
    } else if (!worldsOnDisplay.has(worldEvent.world)) {
        // If the world is not active and not already displayed, append its row.
        await appendEventRow(worldEvent as NonActiveWorldEventStatus, tableSort, tableSortOrder);
    } else {
        // This is the case for an update on an already-displayed non-active world.
        const tbody = document.getElementById("mistyTimerBody");
        if (tbody) {
            // Get the row for the current world.
            const row = tbody.querySelector(`tr[data-world="${worldEvent.world}"]`) as HTMLTableRowElement | null;
            if (row) {
                // Remove the "stopped" attribute so the row updates again.
                row.removeAttribute("data-timer-stopped");
                // Update this row with the latest timing info immediately.
                updateRowTimer(row, worldEvent, Date.now());
            }
        }
        const table = document.getElementById("mistyTimersTable") as HTMLTableElement;
        sortTableByColumn(table, TableColumn[tableSort], tableSortOrder === "asc");
    }
}

async function appendEventRow(
    worldEvent: NonActiveWorldEventStatus,
    sortBy: TableColumnName,
    sortOrder: TableSortOrder,
): Promise<void> {
    const tbody = document.getElementById("mistyTimerBody");
    if (!tbody) return;

    const row = document.createElement("tr");
    row.dataset.world = String(worldEvent.world);

    // Calculate how long the world has been inactive (in milliseconds)
    const inactiveDuration = (Date.now() - worldEvent.last_update_timestamp) / 1000;
    const formattedInactiveDuration = formatTimeLeftValueMisty(inactiveDuration);

    // Helper to create a cell with an optional class.
    const createElement = (text: string, className?: string, element: string = "td"): HTMLElement => {
        const cell = document.createElement(element);
        cell.textContent = text;
        if (className) cell.className = className;
        return cell;
    };

    const allowedRoles = ["775940649802793000"]; // Scouter role
    const hasEditPermission = userHasRequiredRole(allowedRoles);

    const buttonsTd = document.createElement("td");
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "action-buttons";

    if (hasEditPermission) {
        const editBtn = document.createElement("button");
        editBtn.className = "btn-extra";
        editBtn.title = "Edit Misty Timer";
        const editImg = document.createElement("img");
        editImg.src = "./edit_button.png";
        editImg.alt = "Edit action";
        editBtn.appendChild(editImg);
        editBtn.addEventListener("click", () => {
            editMistyTimer(worldEvent.world);
        });
        buttonContainer.appendChild(editBtn);
    }
    buttonsTd.appendChild(buttonContainer);

    // Empty cell for now
    row.appendChild(buttonsTd);
    // Create cells for world, status, and the calculated inactive time.
    row.appendChild(createElement(String(worldEvent.world)));
    row.appendChild(createElement(worldEvent.status));
    row.appendChild(createElement(formattedInactiveDuration, "time-left"));

    // Append the row to the table body
    tbody.appendChild(row);
    worldsOnDisplay.add(worldEvent.world);

    // Map the sortBy option (e.g. "World" | "Status" | "InactiveFor") to its numeric index.
    const columnIndex = TableColumn[sortBy];

    // Re-sort the table based on the given column.
    const table = document.getElementById("mistyTimersTable") as HTMLTableElement;
    if (table) {
        // Here we assume ascending order; you might want to extend this to include a direction parameter.
        sortTableByColumn(table, columnIndex, sortOrder === "asc");
    }
}

// Initialize sorting for each header cell.
function initTableSorting(sortBy: TableColumnName, sortOrder: TableSortOrder): void {
    const table = document.getElementById("mistyTimersTable") as HTMLTableElement;
    if (!table) return;
    const headers = table.querySelectorAll("th");
    headers.forEach((header, index) => {
        if (index === 0) return;
        header.addEventListener("click", () => {
            // Toggle sort direction using a data attribute.
            const currentDir = header.getAttribute("data-sort-dir") || "asc";
            const newDir: TableSortOrder = currentDir === "asc" ? "desc" : "asc";
            header.setAttribute("data-sort-dir", newDir);

            // Update icon in this header.
            const icon = header.querySelector(".sort-icon");
            if (icon) {
                icon.textContent = newDir === "asc" ? "▲" : "▼";
            }

            // Map the header index to our enum.
            let column: TableColumn;
            switch (index) {
                case 1:
                    column = TableColumn.World;
                    break;
                case 2:
                    column = TableColumn.Status;
                    break;
                case 3:
                    column = TableColumn.InactiveFor;
                    break;
                default:
                    console.warn(`No sortable column defined for header index ${index}`);
                    return;
            }

            localStorage.setItem("tableSort", TableColumn[column]);
            localStorage.setItem("tableSortOrder", newDir);

            sortTableByColumn(table, column, newDir === "asc");
        });

        // On startup, if this header corresponds to the stored sort column, update its UI.
        let column: TableColumn | undefined;
        switch (index) {
            case 1:
                column = TableColumn.World;
                break;
            case 2:
                column = TableColumn.Status;
                break;
            case 3:
                column = TableColumn.InactiveFor;
                break;
            default:
                return;
        }

        // TableColumn[column] converts the numeric enum value to its key name.
        const columnName = TableColumn[column] as string;
        if (sortBy && sortBy === columnName) {
            header.setAttribute("data-sort-dir", sortOrder);
            const icon = header.querySelector(".sort-icon");
            if (icon) {
                icon.textContent = sortOrder === "asc" ? "▲" : "▼";
            }
        }

        // If a stored sort column exists, convert it back to a TableColumn enum value and sort.
        if (sortBy) {
            // Convert the stored sort (e.g., "World") to the enum numeric value.
            const sortColumn = (TableColumn as any)[sortBy] as TableColumn;
            sortTableByColumn(table, sortColumn, sortOrder === "asc");
        }
    });
}

// Sort the table rows by a specific column index.
function sortTableByColumn(table: HTMLTableElement, column: TableColumn, asc: boolean): void {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));

    rows.sort((rowA, rowB) => {
        const cellA = rowA.children[column].textContent?.trim() || "";
        const cellB = rowB.children[column].textContent?.trim() || "";

        // For the timer column, parse the timer strings.
        if (column === TableColumn.InactiveFor) {
            const timeA = parseTimerString(cellA);
            const timeB = parseTimerString(cellB);
            return asc ? timeA - timeB : timeB - timeA;
        }

        // Otherwise, try numeric comparison.
        const numA = parseFloat(cellA);
        const numB = parseFloat(cellB);

        if (!isNaN(numA) && !isNaN(numB)) {
            return asc ? numA - numB : numB - numA;
        } else {
            return asc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
        }
    });

    // Reattach the rows in sorted order.
    rows.forEach((row) => tbody.appendChild(row));

    const hideInactiveWorldsElement = document.getElementById("hideInactiveWorlds") as HTMLInputElement;
    const hideUnknownWorldsElement = document.getElementById("hideUnknownWorlds") as HTMLInputElement;
    if (hideInactiveWorldsElement.checked || hideUnknownWorldsElement.checked) hideWorlds();
}

function parseTimerString(timerStr: string): number {
    let totalSeconds = 0;
    const hourMatch = timerStr.match(/(\d+)h/);
    const minuteMatch = timerStr.match(/(\d+)m/);
    const secondMatch = timerStr.match(/(\d+)s/);
    if (hourMatch) {
        totalSeconds += parseInt(hourMatch[1], 10) * 3600;
    }
    if (minuteMatch) {
        totalSeconds += parseInt(minuteMatch[1], 10) * 60;
    }
    if (secondMatch) {
        totalSeconds += parseInt(secondMatch[1], 10);
    }
    return totalSeconds;
}

function hideWorlds(): void {
    const hideInactiveWorldsElement = document.getElementById("hideInactiveWorlds") as HTMLInputElement;
    const hideUnknownWorldsElement = document.getElementById("hideUnknownWorlds") as HTMLInputElement;
    const hideInactive = hideInactiveWorldsElement.checked;
    const hideUnknown = hideUnknownWorldsElement.checked;
    const tbody = document.getElementById("mistyTimersTable");
    if (!tbody) return;

    // Iterate over each row in the misty timers table.
    const rows = Array.from(tbody.getElementsByTagName("tr"));
    for (const row of rows) {
        const cells = row.getElementsByTagName("td");
        if (!cells.length) continue;

        const status = cells[2].textContent?.trim() || "";
        if (hideInactive && status === "Inactive") {
            row.style.display = "none";
        } else if (hideUnknown && status === "Unknown") {
            row.style.display = "none";
        } else {
            row.style.display = "";
        }
    }
}

const hideInactiveWorldsElement = document.getElementById("hideInactiveWorlds") as HTMLInputElement | null;
if (hideInactiveWorldsElement) {
    const storedState = localStorage.getItem("hideInactiveWorlds");
    hideInactiveWorldsElement.checked = storedState === "true";

    hideInactiveWorldsElement.addEventListener("change", (e) => {
        const checkbox = e.target as HTMLInputElement;
        localStorage.setItem("hideInactiveWorlds", checkbox.checked ? "true" : "false");
        hideWorlds();
    });
}

const hideUnknownWorldsElement = document.getElementById("hideUnknownWorlds") as HTMLInputElement | null;
if (hideUnknownWorldsElement) {
    const storedState = localStorage.getItem("hideUnknownWorlds");
    hideUnknownWorldsElement.checked = storedState === "true";

    hideUnknownWorldsElement.addEventListener("change", (e) => {
        const checkbox = e.target as HTMLInputElement;
        localStorage.setItem("hideUnknownWorlds", checkbox.checked ? "true" : "false");
        hideWorlds();
    });
}

/**
 * Toggle editing mode for a misty timer row based on the world number.
 *
 * The original timer format is "Xh XXm XXs" but it may be incomplete (e.g., "05m 30s" or "30s").
 * On entering edit mode, the status cell is replaced with a dropdown and the timer cell with three number inputs.
 * - Hour input: type="number", min="0", max="2"
 * - Minute input: type="number", min="0", max="59"
 * - Second input: type="number", min="0", max="59"
 *
 * When saving, the function formats the value conditionally:
 * - If hour > 0, include the hour part ("Xh ")
 * - If hour or minute is nonzero, include the minute part ("XXm ")
 * - Always include seconds ("XXs")
 *
 * @param world - The world number used to identify which row to edit.
 */
async function editMistyTimer(world: number): Promise<void> {
    // Retrieve the table row using the data attribute.
    const row = document.querySelector(`tr[data-world="${world}"]`) as HTMLTableRowElement;
    if (!row) return;

    // Retrieve the world event information from worldMap.
    const worldEvent = worldMap.get(world);
    if (!worldEvent) return;

    // Check if the row is not yet being edited.
    if (!row.classList.contains("editing")) {
        row.classList.add("editing");

        // Save the original values for the editable cells.
        // Column 2: Status, Column 3: Misty Timer
        row.dataset.originalStatus = row.cells[2].textContent || "";
        row.dataset.originalTimer = row.cells[3].textContent || "";

        // --- Column 2: Status (dropdown) ---
        row.cells[2].innerHTML = "";
        const statusSelect = document.createElement("select");
        statusSelect.classList.add("misty-status-dropdown");

        // Define known statuses (adjust if necessary).
        const KNOWN_STATUSES: Exclude<WorldStatus, "Active">[] = ["Inactive", "Spawnable", "Unknown"];
        KNOWN_STATUSES.forEach((status) => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            if (status === row.dataset.originalStatus) {
                option.selected = true;
            }
            statusSelect.appendChild(option);
        });
        row.cells[2].appendChild(statusSelect);

        // --- Column 3: Misty Timer (numeric inputs) ---
        // Parse original format "Xh XXm XXs", which may be incomplete (e.g., "05m 30s" or "30s").
        const originalTimer = row.dataset.originalTimer || "0h 00m 00s";
        const tokens = originalTimer.split(" ");
        let hoursStr = "0";
        let minutesStr = "0";
        let secondsStr = "0";

        tokens.forEach((token) => {
            if (token.endsWith("h")) {
                hoursStr = token.slice(0, -1);
            } else if (token.endsWith("m")) {
                minutesStr = token.slice(0, -1);
            } else if (token.endsWith("s")) {
                secondsStr = token.slice(0, -1);
            }
        });

        row.cells[3].innerHTML = "";

        // Hour input.
        const hourInput = document.createElement("input");
        hourInput.type = "number";
        hourInput.classList.add("misty-timer-hour");
        hourInput.value = hoursStr;
        hourInput.min = "0";
        hourInput.max = "2";
        hourInput.step = "1";
        hourInput.size = 1; // This provides a hint for one-digit input.
        row.cells[3].appendChild(hourInput);

        // Hour label.
        const hourLabel = document.createElement("span");
        hourLabel.textContent = "h ";
        row.cells[3].appendChild(hourLabel);

        // Minute input.
        const minuteInput = document.createElement("input");
        minuteInput.type = "number";
        minuteInput.classList.add("misty-timer-minute");
        minuteInput.value = minutesStr;
        minuteInput.min = "0";
        minuteInput.max = "59";
        minuteInput.step = "1";
        minuteInput.size = 2;
        row.cells[3].appendChild(minuteInput);

        // Minute label.
        const minuteLabel = document.createElement("span");
        minuteLabel.textContent = "m ";
        row.cells[3].appendChild(minuteLabel);

        // Second input.
        const secondInput = document.createElement("input");
        secondInput.type = "number";
        secondInput.classList.add("misty-timer-second");
        secondInput.value = secondsStr;
        secondInput.min = "0";
        secondInput.max = "59";
        secondInput.step = "1";
        secondInput.size = 2;
        row.cells[3].appendChild(secondInput);

        // Second label.
        const secondLabel = document.createElement("span");
        secondLabel.textContent = "s";
        row.cells[3].appendChild(secondLabel);
    } else {
        // Commit the changes and exit editing mode.
        row.classList.remove("editing");
        const MAX_SECONDS_ALLOWED = 2 * 3600 + 16 * 60; // 8160 seconds

        // --- Column 2: Commit the Status change ---
        const statusCell = row.cells[2];
        const statusSelectEl = statusCell.querySelector("select");
        if (statusSelectEl) {
            statusCell.textContent = statusSelectEl.value;
        }

        // --- Column 3: Update Misty Timer ---
        const timerCell = row.cells[3];
        const hourInputEl = timerCell.querySelector("input.misty-timer-hour") as HTMLInputElement;
        const minuteInputEl = timerCell.querySelector("input.misty-timer-minute") as HTMLInputElement;
        const secondInputEl = timerCell.querySelector("input.misty-timer-second") as HTMLInputElement;
        let totalSeconds = 0;
        if (hourInputEl && minuteInputEl && secondInputEl) {
            // Parse numbers for conditional formatting.
            const hour = parseInt(hourInputEl.value, 10) || 0;
            const minute = parseInt(minuteInputEl.value, 10) || 0;
            const second = parseInt(secondInputEl.value, 10) || 0;

            let parts: string[] = [];
            // Include hour if it's greater than 0.
            if (hour > 0) {
                parts.push(`${hour}h`);
            }
            // Include minute if there's an hour or if minute > 0.
            if (hour > 0 || minute > 0) {
                parts.push(`${minute.toString().padStart(2, "0")}m`);
            }
            // Always include seconds.
            parts.push(`${second.toString().padStart(2, "0")}s`);

            const formattedTimer = parts.join(" ");
            timerCell.textContent = formattedTimer;
            totalSeconds = hour * 3600 + minute * 60 + second;
        }

        // --- Optional: Check if values have changed ---
        const newStatus = row.cells[2].textContent?.trim() || "";
        const newTimer = row.cells[3].textContent?.trim() || "";

        const unchanged =
            newStatus === (row.dataset.originalStatus?.trim() || "") &&
            newTimer === (row.dataset.originalTimer?.trim() || "");

        if (unchanged) {
            // If nothing has changed, do nothing further.
            return;
        }

        if (totalSeconds > MAX_SECONDS_ALLOWED) {
            // Revert cells to the original values if the new total exceeds the limit.
            row.cells[2].textContent = row.dataset.originalStatus || "";
            row.cells[3].textContent = row.dataset.originalTimer || "";
            showToast("❌ Timer value exceeds maximum allowed (2h 16m 00s)", "error");
            return;
        }

        await axios.patch(`${API_URL}/worlds/${world}/event?type=inactive&seconds=${totalSeconds}&editor=Manual`, {
            headers: {
                "Content-Type": "application/json",
                Origin: ORIGIN,
            },
        });
        wsClient.send({ world: Number(world) } as WorldRecord);
        showToast(`Misty time updated for world ${world}`);
        console.log(`Misty time updated for world ${world}`);
    }
}
