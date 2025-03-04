import { UUIDTypes } from "uuid";
import { EventRecord } from "./events";
import { wsClient } from "./ws";

export let eventHistory: EventRecord[] = [];
export let expiredEvents: EventRecord[] = [];
export const rowMap = new Map<UUIDTypes, HTMLTableRowElement>();

// Local refresh interval for timer updates.
let refreshInterval: NodeJS.Timeout | null = null;

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
        const cells = row.getElementsByTagName("td");
        const timeLeftText = cells[3].textContent?.trim() || "";
        if (hideExpired && timeLeftText === "Expired") {
            row.style.display = "none";
        } else {
            row.style.display = "";
        }
    }

    // if (!hideExpired) {
    //     const now = Date.now();
    //     eventHistory.forEach((event) => {
    //         const elapsed = (now - event.timestamp) / 1000;
    //         let remaining = event.duration - elapsed;
    //         if (remaining < 0) remaining = 0;
    //         if (remaining === 0) {
    //             // Check if there's already a row for this event.
    //             if (
    //                 !tbody.querySelector(
    //                     `tr[data-timestamp="${event.timestamp}"]`,
    //                 )
    //             ) {
    //                 // Append the expired event row.
    //                 appendEventRow(event, false);
    //             }
    //         }
    //     });
    // }
}

export function renderEventHistory(): void {
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
        if (remaining > 0) {
            activeEvents.push(event);
        } else {
            const exists = expiredEvents.some((e) => e.id === event.id);
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

    // On initial render, sort active events to the top of the table
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
    rowMap.clear();
    saveEventHistory();

    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;
    tbody.innerHTML = "";
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
        (e) => checkActive(e) && e.id === event.id,
    );
    if (idx !== -1) {
        eventHistory[idx] = event; // Update the event in the history.
        saveEventHistory(); // Save the updated event history.

        // Update the row in the event history table.
        const row = rowMap.get(event.id);
        if (row) {
            updateTableRowCells(row, [
                { cellIndex: 1, newContent: event.event },
                { cellIndex: 2, newContent: event.world },
                { cellIndex: 3, newContent: formatTimeLeft(event) },
                { cellIndex: 4, newContent: event.reportedBy },
            ]);

            restartRefreshInterval();
        }
    }
}

export function updateEventTimers(): void {
    const now = Date.now();

    eventHistory.forEach((event) => {
        const elapsed = (now - event.timestamp) / 1000;
        let remaining = event.duration - elapsed;
        if (remaining < 0) {
            remaining = 0;
            const alreadyExpired = expiredEvents.some((e) => e.id === event.id);
            if (!alreadyExpired) {
                expiredEvents.push(event);
                moveExpiredEventBelowActiveEvents(event);
            }
        }

        const row = rowMap.get(event.id);
        if (row) {
            if (row && row.classList.contains("editing")) return;
            updateTableRowCells(row, [
                { cellIndex: 3, newContent: formatTimeLeftValue(remaining) },
            ]);
        }
    });

    const activeEvents = eventHistory.filter(checkActive);
    if (activeEvents.length === 0 && refreshInterval) {
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

function moveExpiredEventBelowActiveEvents(event: EventRecord): void {
    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;

    const row = rowMap.get(event.id);
    if (!row) return;

    // Find the first expired row (i.e. with "Expired" text in the time cell) among non-editing rows.
    const rows = Array.from(
        tbody.getElementsByTagName("tr"),
    ) as HTMLTableRowElement[];

    let firstExpiredRow: HTMLTableRowElement | null = null;
    for (const r of rows) {
        // Assume the time cell is at index 3.
        const timeText = r.cells[3]?.textContent?.trim();
        if (timeText === "Expired") {
            firstExpiredRow = r;
            break;
        }
    }

    if (firstExpiredRow) {
        // Insert our newly expired row above the first expired row.
        tbody.insertBefore(row, firstExpiredRow);
    } else {
        // If there are no expired rows, then this row is the first expired one.
        // We need to place it after the last active event.
        // One simple way is to append it at the bottom.
        tbody.appendChild(row);
    }

    // Update the action cell (assumed to be index 0) to replace the edit button with a close button.
    const actionCell = row.cells[0];
    if (actionCell) {
        actionCell.innerHTML = ""; // Clear any existing content.

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "action-buttons";

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn-close";
        removeBtn.title = "Clear this event";

        const closeImg = document.createElement("img");
        closeImg.src = "./close_button.png";
        closeImg.alt = "Close event";

        removeBtn.appendChild(closeImg);

        removeBtn.addEventListener("click", () => removeEvent(event));

        buttonContainer.appendChild(removeBtn);
        actionCell.appendChild(buttonContainer);
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
    if (highlight) {
        row.classList.add("favourite-event");
    }

    const now = Date.now();
    const elapsed = (now - event.timestamp) / 1000;
    const remaining = event.duration - elapsed;

    const buttonsTd = document.createElement("td");
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "action-buttons";

    // if (remaining <= 0) {
    //     const removeBtn = document.createElement("button");
    //     removeBtn.className = "btn-close";
    //     removeBtn.title = "Clear this event";
    //     const closeImg = document.createElement("img");
    //     closeImg.src = "./close_button.png";
    //     closeImg.alt = "Close event";
    //     removeBtn.appendChild(closeImg);
    //     removeBtn.addEventListener("click", () => removeEvent(event));
    //     buttonContainer.appendChild(removeBtn);
    //     buttonsTd.appendChild(buttonContainer);
    // } else {
    const editBtn = document.createElement("button");
    editBtn.className = "btn-extra";
    editBtn.title = "Edit event";
    const editImg = document.createElement("img");
    editImg.src = "./edit_button.png";
    editImg.alt = "Edit action";
    editBtn.appendChild(editImg);
    editBtn.addEventListener("click", () => editEvent(event, editBtn));
    buttonContainer.appendChild(editBtn);
    // }
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
    rowMap.set(event.id, row);
}

function removeEvent(event: EventRecord): void {
    eventHistory = eventHistory.filter((e) => e.id !== event.id);
    expiredEvents = expiredEvents.filter((e) => e.id !== event.id);
    saveEventHistory();

    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;

    const expiredEventRow = rowMap.get(event.id);
    if (expiredEventRow) {
        tbody.removeChild(expiredEventRow);
    }

    // Remove expired event
    rowMap.delete(event.id);
}

function checkActive(event: EventRecord): boolean {
    const now = Date.now();
    const elapsed = (now - event.timestamp) / 1000;
    let remaining = event.duration - elapsed;
    return remaining > 0;
}

function editEvent(event: EventRecord, button: HTMLButtonElement): void {
    const row = rowMap.get(event.id);
    if (!row) return;

    if (!row.classList.contains("editing")) {
        row.classList.add("editing");

        // Store original values for each editable cell (indexes 1-4).
        row.dataset.originalEvent = row.cells[1].textContent || "";
        row.dataset.originalWorld = row.cells[2].textContent || "";
        row.dataset.originalDuration = row.cells[3].textContent || "";
        row.dataset.originalReportedBy = row.cells[4].textContent || "";
        row.dataset.timestamp = event.timestamp.toString() || "";

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
                ? event.duration
                : parseDuration(newDurationText);

        const newTimestamp =
            newDurationText === row.dataset.originalDuration?.trim()
                ? event.timestamp
                : Date.now();

        const updatedEvent: EventRecord = {
            id: event.id,
            type: "editEvent",
            event: row.cells[1].textContent?.trim() || "",
            world: row.cells[2].textContent?.trim() || "",
            duration: newDuration,
            reportedBy: row.cells[4].textContent?.trim() || "",
            timestamp: newTimestamp,
            oldEvent: event,
        };

        rowMap.set(event.id, row);

        const idx = eventHistory.findIndex(
            (e) => checkActive(e) && e.id === event.id,
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
