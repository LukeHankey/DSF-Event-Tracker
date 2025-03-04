import { EventRecord } from "./events";
import { wsClient } from "./ws";

export let eventHistory: EventRecord[] = [];
export let expiredEvents: EventRecord[] = [];
export const timeLeftCells = new Map<number, HTMLElement>();

// Local refresh interval for timer updates.
let refreshInterval: NodeJS.Timeout | null = null;

export function loadEventHistory(): void {
    const stored = localStorage.getItem("eventHistory");
    if (stored) {
        try {
            eventHistory = JSON.parse(stored);
            renderEventHistory();
        } catch (e) {
            console.error("Error parsing eventHistory from localStorage", e);
            eventHistory = [];
        }
    }
}

export function saveEventHistory(): void {
    localStorage.setItem("eventHistory", JSON.stringify(eventHistory));
}

export function clearEventHistory(): void {
    eventHistory = [];
    expiredEvents = [];
    saveEventHistory();
    renderEventHistory();
}

export function addNewEvent(newEvent: EventRecord): void {
    eventHistory.push(newEvent);
    saveEventHistory();

    const favMode = localStorage.getItem("favoriteEventsMode") || "none";
    const savedFavourites = localStorage.getItem("favoriteEvents");
    const favouriteEvents = savedFavourites
        ? (JSON.parse(savedFavourites) as string[])
        : [];

    if (favMode === "only" && !favouriteEvents.includes(newEvent.event)) {
        return;
    }

    // Append a new row for the event.
    appendEventRow(
        newEvent,
        favMode === "highlight" && favouriteEvents.includes(newEvent.event),
    );
    restartRefreshInterval();
}

export function updateEvent(event: EventRecord): void {
    const idx = eventHistory.findIndex(
        (e) =>
            checkActive(e) &&
            e.event === event.oldEvent.event &&
            e.world === event.oldEvent.world,
    );
    if (idx !== -1) {
        eventHistory[idx] = event;
        saveEventHistory();
        if (!timeLeftCells.has(event.timestamp)) {
            timeLeftCells.set(event.timestamp, timeLeftCells.get(event.oldEvent.timestamp));
            timeLeftCells.delete(event.oldEvent.timestamp);
        }
        restartRefreshInterval();
    }
}

export function updateHideExpiredRows(): void {
    const hideExpiredCheckbox = document.getElementById(
        "hideExpiredCheckbox",
    ) as HTMLInputElement | null;
    if (!hideExpiredCheckbox) return;
    const hideExpired = hideExpiredCheckbox.checked;
    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;

    // Iterate over each row in the event history table.
    const rows = Array.from(tbody.getElementsByTagName("tr"));
    for (const row of rows) {
        // Assume the "Time Left" cell is the fourth cell (index 3)
        const cells = row.getElementsByTagName("td");
        if (cells.length < 4) continue;
        const timeLeftText = cells[3].textContent?.trim() || "";
        // If the cell text indicates the event is expired (for example, "Expired"),
        // hide the row if the checkbox is checked, otherwise show it.
        if (hideExpired && timeLeftText === "Expired") {
            row.style.display = "none";
        } else {
            row.style.display = "";
        }
    }

    if (!hideExpired) {
        const now = Date.now();
        eventHistory.forEach((event) => {
            const elapsed = (now - event.timestamp) / 1000;
            let remaining = event.duration - elapsed;
            if (remaining < 0) remaining = 0;
            if (remaining === 0) {
                // Check if there's already a row for this event.
                if (
                    !tbody.querySelector(
                        `tr[data-timestamp="${event.timestamp}"]`,
                    )
                ) {
                    // Append the expired event row.
                    appendEventRow(event, false);
                }
            }
        });
    }
}

export function renderEventHistory(): void {
    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    timeLeftCells.clear();

    const now = Date.now();
    const savedFavourites = localStorage.getItem("favoriteEvents");
    const favouriteEvents = savedFavourites
        ? (JSON.parse(savedFavourites) as string[])
        : [];
    const favMode = localStorage.getItem("favoriteEventsMode") || "none";

    let eventsToRender = eventHistory.slice();
    if (favMode === "only") {
        eventsToRender = eventsToRender.filter((event) =>
            favouriteEvents.includes(event.event),
        );
    }

    const activeEvents: EventRecord[] = [];
    eventsToRender.forEach((event) => {
        const elapsed = (now - event.timestamp) / 1000;
        let remaining = event.duration - elapsed;
        if (remaining < 0) remaining = 0;
        if (remaining > 0) {
            activeEvents.push(event);
        } else {
            const exists = expiredEvents.some(
                (e) => e.timestamp === event.timestamp,
            );
            if (!exists) {
                expiredEvents.push(event);
            }
        }
    });

    if (favMode === "pin") {
        activeEvents.sort((a, b) => {
            const aFav = favouriteEvents.includes(a.event);
            const bFav = favouriteEvents.includes(b.event);
            if (aFav && !bFav) return 1;
            if (!aFav && bFav) return -1;
            return 0;
        });
    }

    let sortedEvents = [...expiredEvents, ...activeEvents];
    if (favMode === "only") {
        sortedEvents = sortedEvents.filter((event) =>
            favouriteEvents.includes(event.event),
        );
    }

    const hideExpiredCheckbox = document.getElementById(
        "hideExpiredCheckbox",
    ) as HTMLInputElement | null;
    const hideExpired = hideExpiredCheckbox
        ? hideExpiredCheckbox.checked
        : false;
    sortedEvents.forEach((event) => {
        const elapsed = (now - event.timestamp) / 1000;
        let remaining = event.duration - elapsed;
        if (remaining < 0) remaining = 0;

        if (hideExpired && remaining === 0) return;
        const isFavourite = favouriteEvents.includes(event.event);
        const shouldHighlight = favMode === "highlight" && isFavourite;
        appendEventRow(event, shouldHighlight);
    });
}

/**
 * Updates one or more cells in a table row.
 *
 * @param row - The HTMLTableRowElement to update.
 * @param updates - An array of update objects, each specifying:
 *    - cellIndex: the index of the cell to update,
 *    - newContent (optional): the new text content for the cell,
 *    - newClass (optional): a new class name to assign,
 *    - newStyle (optional): an object containing CSS properties and values to assign.
 */
export function updateTableRowCells(
    row: HTMLTableRowElement,
    updates: {
        cellIndex: number;
        newContent?: string;
        newClass?: string;
        newStyle?: Partial<CSSStyleDeclaration>;
    }[],
): void {
    updates.forEach((update) => {
        const cell = row.cells[update.cellIndex];
        if (!cell) return;
        if (update.newContent !== undefined) {
            cell.textContent = update.newContent;
        }
        if (update.newClass !== undefined) {
            cell.className = update.newClass;
        }
        if (update.newStyle !== undefined) {
            Object.assign(cell.style, update.newStyle);
        }
    });
}

export function updateEventTimers(): void {
    const now = Date.now();
    let anyEventExpired = false;

    eventHistory.forEach((event) => {
        const elapsed = (now - event.timestamp) / 1000;
        let remaining = event.duration - elapsed;
        if (remaining < 0) {
            remaining = 0;
            const alreadyExpired = expiredEvents.some(
                (e) => e.timestamp === event.timestamp,
            );
            if (!alreadyExpired) {
                expiredEvents.push(event);
                anyEventExpired = true;
            }
        }

        const timeCell = timeLeftCells.get(event.timestamp);
        if (timeCell) {
            const row = timeCell.closest("tr") as HTMLTableRowElement;
            if (row && row.classList.contains("editing")) return;
            updateTableRowCells(row, [
                { cellIndex: 1, newContent: event.event },
                { cellIndex: 2, newContent: event.world },
                { cellIndex: 3, newContent: formatTimeLeftValue(remaining) },
                { cellIndex: 4, newContent: event.reportedBy },
            ]);
        }
    });

    if (anyEventExpired) {
        renderEventHistory();
    }

    const visibleEvents = eventHistory.filter((event) => {
        const elapsed = (now - event.timestamp) / 1000;
        let remaining = event.duration - elapsed;
        return remaining > 0;
    });
    if (visibleEvents.length === 0 && refreshInterval) {
        stopEventTimerRefresh();
        console.log("Interval has stopped", refreshInterval);
    }
}

export function startEventTimerRefresh(): void {
    if (!refreshInterval) {
        refreshInterval = setInterval(() => {
            updateEventTimers();
        }, 1000);
    }
}

export function stopEventTimerRefresh(): void {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

function restartRefreshInterval(): void {
    stopEventTimerRefresh();
    startEventTimerRefresh();
}

function appendEventRow(event: EventRecord, highlight: boolean = false): void {
    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;

    const row = document.createElement("tr");
    row.dataset.timestamp = event.timestamp.toString();
    if (highlight) {
        row.classList.add("favourite-event");
    }

    const now = Date.now();
    const elapsed = (now - event.timestamp) / 1000;
    const remaining = event.duration - elapsed;

    const buttonsTd = document.createElement("td");
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "action-buttons";

    if (remaining <= 0) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "btn-close";
        removeBtn.title = "Clear this event";
        const closeImg = document.createElement("img");
        closeImg.src = "./close_button.png";
        closeImg.alt = "Close event";
        removeBtn.appendChild(closeImg);
        removeBtn.addEventListener("click", () => removeEvent(event));
        buttonContainer.appendChild(removeBtn);
        buttonsTd.appendChild(buttonContainer);
    } else {
        const editBtn = document.createElement("button");
        editBtn.className = "btn-extra";
        editBtn.title = "Edit event";
        const editImg = document.createElement("img");
        editImg.src = "./edit_button.png";
        editImg.alt = "Edit action";
        editBtn.appendChild(editImg);
        editBtn.addEventListener("click", () => editEvent(event, editBtn));
        buttonContainer.appendChild(editBtn);
    }
    buttonsTd.appendChild(buttonContainer);
    row.appendChild(buttonsTd);

    // Helper to create a cell with optional class.
    const createCell = (
        text: string,
        className?: string,
    ): HTMLTableCellElement => {
        const cell = document.createElement("td");
        cell.textContent = text;
        if (className) cell.className = className;
        return cell;
    };

    // Create cells for event, world, time left, and reportedBy.
    row.appendChild(createCell(event.event));
    row.appendChild(createCell(event.world));
    row.appendChild(createCell(formatTimeLeft(event), "time-left"));
    row.appendChild(createCell(event.reportedBy || "Unknown"));

    tbody.insertBefore(row, tbody.firstChild);
    timeLeftCells.set(event.timestamp, row.cells[3]);
}

function removeEvent(event: EventRecord): void {
    eventHistory = eventHistory.filter((e) => e.timestamp !== event.timestamp);
    expiredEvents = expiredEvents.filter(
        (e) => e.timestamp !== event.timestamp,
    );
    saveEventHistory();
    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;
    const rows = Array.from(tbody.getElementsByTagName("tr"));
    for (const row of rows) {
        if (row.dataset.timestamp === event.timestamp.toString()) {
            tbody.removeChild(row);
            break;
        }
    }
}

function checkActive(event: EventRecord): boolean {
    const now = Date.now();
    const elapsed = (now - event.timestamp) / 1000;
    let remaining = event.duration - elapsed;
    return remaining >= 0;
}

function editEvent(event: EventRecord, button: HTMLButtonElement): void {
    const row = button.closest("tr") as HTMLTableRowElement | null;
    if (!row) return;

    const currentTimestamp = parseInt(row.dataset.timestamp);
    const latestEvent = eventHistory.find(
        (e) => e.timestamp === currentTimestamp,
    ) || event;

    if (!row.classList.contains("editing")) {
        row.classList.add("editing");

        // Store original values for each editable cell (indexes 1-4).
        row.dataset.originalEvent = row.cells[1].textContent || "";
        row.dataset.originalWorld = row.cells[2].textContent || "";
        row.dataset.originalDuration = row.cells[3].textContent || "";
        row.dataset.originalReportedBy = row.cells[4].textContent || "";
        row.dataset.timestamp = latestEvent.timestamp.toString() || "";

        Array.from(row.cells).forEach((cell, index) => {
            if (index > 0) {
                cell.contentEditable = "true";
                cell.style.border = "1px dashed #ccc";
            }
        });
    } else {
        row.classList.remove("editing");
        Array.from(row.cells).forEach((cell, index) => {
            if (index > 0) {
                cell.contentEditable = "false";
                cell.style.border = "none";
            }
        });

        const unchanged =
            row.cells[1].textContent?.trim() ===
                row.dataset.originalEvent?.trim() &&
            row.cells[2].textContent?.trim() ===
                row.dataset.originalWorld?.trim() &&
            row.cells[3].textContent?.trim() ===
                row.dataset.originalDuration?.trim() &&
            row.cells[4].textContent?.trim() ===
                row.dataset.originalReportedBy?.trim();

        if (unchanged) return;

        // Note: if the duration cell wasn’t changed, we want to keep the original duration value.
        const newDurationText = row.cells[3].textContent?.trim() || "";
        const newDuration =
            newDurationText === row.dataset.originalDuration?.trim()
                ? latestEvent.duration
                : parseDuration(newDurationText);

        const newTimestamp =
            newDurationText === row.dataset.originalDuration?.trim()
                ? latestEvent.timestamp
                : Date.now();

        // If the timestamp changed, update the row's data attribute.
        if (newTimestamp !== latestEvent.timestamp) {
            row.dataset.timestamp = newTimestamp.toString();
        }

        const updatedEvent: EventRecord = {
            type: "editEvent",
            event: row.cells[1].textContent?.trim() || "",
            world: row.cells[2].textContent?.trim() || "",
            duration: newDuration,
            reportedBy: row.cells[4].textContent?.trim() || "",
            timestamp: newTimestamp,
            oldEvent: latestEvent,
        };

        const timeLeftTd = timeLeftCells.get(latestEvent.timestamp);
        if (timeLeftTd) {
            if (newTimestamp !== latestEvent.timestamp) {
                timeLeftCells.delete(latestEvent.timestamp);
                timeLeftCells.set(newTimestamp, timeLeftTd);
            }
        }

        const idx = eventHistory.findIndex(
            (e) =>
                checkActive(e) &&
                e.event === latestEvent.event &&
                e.world === latestEvent.world,
        );
        if (idx !== -1) {
            eventHistory[idx] = updatedEvent;
            saveEventHistory();
            restartRefreshInterval();
        }
        wsClient.send(updatedEvent);
    }
}

function formatTimeLeft(event: EventRecord): string {
    const now = Date.now();
    const elapsed = (now - event.timestamp) / 1000;
    let remaining = event.duration - elapsed;
    if (remaining < 0) remaining = 0;
    return formatTimeLeftValue(remaining);
}

function formatTimeLeftValue(seconds: number): string {
    if (seconds <= 0) return "Expired";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
}

function parseDuration(durationStr: string): number {
    const regex = /^(\d+)m\s(\d+)s$/;
    const match = durationStr.match(regex);
    if (!match) {
        throw new Error(`Invalid duration format: ${durationStr}`);
    }
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    return minutes * 60 + seconds;
}
