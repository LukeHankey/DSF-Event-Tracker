import axios from "axios";
import { API_URL } from "../config";

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

        for (const currentWorldEvent of currentWorldEvents) {
            worldMap.set(currentWorldEvent.world, currentWorldEvent);
            if (currentWorldEvent.status === "Active") continue;
            appendEventRow(currentWorldEvent);
        }
        initTableSorting();
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

// Timer function to update the world timers:
function updateWorldTimers(): void {
    const tbody = document.getElementById("mistyTimerBody");
    if (!tbody) return;

    const now = Date.now();
    const rows = Array.from(tbody.getElementsByTagName("tr"));

    for (const row of rows) {
        // If this row’s timer is already stopped, skip it.
        if (row.getAttribute("data-timer-stopped") === "true") continue;

        // Assuming the world id is stored as a data attribute:
        const world = Number(row.dataset.world);
        const worldEventStatus = worldMap.get(world);
        if (!worldEventStatus) continue;

        const lastUpdate = worldEventStatus.last_update_timestamp;
        if (!lastUpdate) continue;

        // Calculate elapsed time in seconds.
        const secondsElapsed = (now - lastUpdate) / 1000;

        const cells = row.getElementsByTagName("td");
        const timerCell = cells[3];
        const statusCell = cells[2];

        // Check if the elapsed time is >= 2 hours 16 minutes (8160 seconds).
        if (secondsElapsed >= 8160) {
            // Update the status to "Unknown" if it isn’t already.
            if (worldEventStatus.status !== "Unknown") {
                const updatedEvent: UnknownWorldEventStatus = {
                    world,
                    last_update_timestamp: worldEventStatus.last_update_timestamp,
                    status: "Unknown",
                };
                worldMap.set(world, updatedEvent);
            }
            // Mark this row as stopped so it won't be updated further.
            row.setAttribute("data-timer-stopped", "true");

            // Option 1: Freeze the timer cell at 2:16:00.
            const fixedTime = formatTimeLeftValueMisty(8160);
            if (timerCell) {
                timerCell.textContent = fixedTime;
            }
            // Update the status cell to "Unknown".
            const statusCell = cells[2];
            if (statusCell) {
                statusCell.textContent = "Unknown";
            }
            // Skip further processing for this row.
            continue;
        }

        // Otherwise, update the timer as usual.
        const formattedTime = formatTimeLeftValueMisty(secondsElapsed);
        if (timerCell) {
            timerCell.textContent = formattedTime;
        }
        if (statusCell) {
            statusCell.textContent = worldEventStatus.status;
        }
    }
}

function formatTimeLeftValueMisty(seconds: number): string {
    const totalMinutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    // If total minutes exceed 59, calculate hours.
    if (totalMinutes > 59) {
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return `${hrs}h ${mins}m ${secs}s`;
    }

    return `${totalMinutes}m ${secs}s`;
}

export function updateWorld(worldEvent: WorldEventStatus): void {
    // Update the stored status for the world.
    worldMap.set(worldEvent.world, worldEvent);

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
        appendEventRow(worldEvent as NonActiveWorldEventStatus);
    }
}

function appendEventRow(worldEvent: NonActiveWorldEventStatus): void {
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

    // Empty cell for now
    row.appendChild(document.createElement("td"));
    // Create cells for world, status, and the calculated inactive time.
    row.appendChild(createElement(String(worldEvent.world)));
    row.appendChild(createElement(worldEvent.status));
    row.appendChild(createElement(formattedInactiveDuration, "time-left"));

    // Append the row to the table body
    tbody.appendChild(row);
    worldsOnDisplay.add(worldEvent.world);
}

// Initialize sorting for each header cell.
function initTableSorting(): void {
    const table = document.getElementById("mistyTimersTab") as HTMLTableElement;
    if (!table) return;
    const headers = table.querySelectorAll("th");
    headers.forEach((header, index) => {
        header.addEventListener("click", () => {
            // Toggle sort direction using a data attribute.
            const currentDir = header.getAttribute("data-sort-dir") || "asc";
            const newDir = currentDir === "asc" ? "desc" : "asc";
            header.setAttribute("data-sort-dir", newDir);

            // Update icon in this header.
            const icon = header.querySelector(".sort-icon");
            if (icon) {
                icon.textContent = newDir === "asc" ? "▲" : "▼";
            }

            sortTableByColumn(table, index, newDir === "asc");
        });
    });
}

// Sort the table rows by a specific column index.
function sortTableByColumn(table: HTMLTableElement, columnIndex: number, asc: boolean): void {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));

    rows.sort((rowA, rowB) => {
        const cellA = rowA.children[columnIndex].textContent?.trim() || "";
        const cellB = rowB.children[columnIndex].textContent?.trim() || "";

        // For the timer column, parse the timer strings.
        if (columnIndex === 3) {
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
