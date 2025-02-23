import * as a1lib from "alt1";
import ChatBoxReader from "alt1/chatbox";
import * as OCR from "alt1/ocr";
import axios from "axios";
import { webpackImages } from "alt1/base";
import font from "alt1/fonts/aa_8px_mono.js";
import { Events, EventKeys, events, eventTimes, EventRecord } from "./events";

/**
 * ChatBoxReader & color definitions
 */
const chatbox = new ChatBoxReader();
chatbox.readargs.colors.push(
    a1lib.mixColor(...[239, 0, 0]), // red text
    a1lib.mixColor(...[255, 100, 0]), // dark orange text
    a1lib.mixColor(...[255, 136, 0]), // dsf merch text
    a1lib.mixColor(...[0, 166, 82]), // misty text
    a1lib.mixColor(...[50, 120, 190]), // fisherman
);

/**
 * Image references for world number detection
 */
const imgs = webpackImages({
    runescapeWorldPretext: require("../assets/runescape_world_pretext.data.png"),
});

/**
 * Internal state variables
 */
let captureInterval: NodeJS.Timeout | null;
let refreshInterval: NodeJS.Timeout | null = null;
let previousMainContent: string;
let hasTimestamps: boolean;
let lastTimestamp: Date;
let lastMessage: string;

let worldHopMessage = false;
let mainboxRect = false;
let eventHistory: EventRecord[] = [];
const timeLeftCells = new Map<number, HTMLElement>();

// Toggle for debugging
export const DEBUG = false;
let ORIGIN = DEBUG
    ? document.location.href
    : "https://lukehankey.github.io/DSF-Event-Tracker/";

// When the page loads, hide the debug container if not in debug mode.
window.addEventListener("DOMContentLoaded", () => {
    const debugContainer = document.getElementById("debugContainer");
    if (debugContainer) {
        if (!DEBUG) {
            debugContainer.style.display = "none";
        } else {
            debugContainer.style.display = ""; // or "block"
        }
    }
});

/**
 * Initialize capture logic
 * - Store initial main content
 * - Load and render event history
 * - Set up one refresh interval for updating timers
 */
export function initCapture(): void {
    if (localStorage.getItem("captureFrequency") == null) {
        localStorage.setItem("captureFrequency", "2");
    }
    previousMainContent = document.querySelector("#mainTab p")!.innerHTML;
    loadEventHistory();

    // Start timer only if event history is visible:
    const eventHistoryTab = document.getElementById("eventHistoryTab");
    if (eventHistoryTab?.classList.contains("sub-tab__content--active")) {
        startEventTimerRefresh();
    }
}

/**
 * Capture the screen with alt1
 */
export function capture(): void {
    if (!window.alt1) {
        document.querySelector("#mainTab p")!.textContent =
            "You need to run this page in alt1 to capture the screen.";
        return;
    }
    if (
        !alt1.permissionPixel ||
        !alt1.permissionGameState ||
        !alt1.permissionOverlay
    ) {
        document.querySelector("#mainTab p")!.textContent =
            "Page is not installed as an app or permissions are not correct.";
        return;
    }

    try {
        const img = a1lib.captureHoldFullRs();
        readChatFromImage(img);
    } catch (err) {
        console.log("Failed to capture screen:", err);
    }
}

/**
 * Continuously capture the screen every second
 */
export function startCapturing(): void {
    if (captureInterval) return; // already running
    captureInterval = setInterval(
        capture,
        (parseInt(localStorage.getItem("captureFrequency")) || 2) * 1000,
    );
}

/**
 * Stop capturing
 */
export function stopCapturing(): void {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
}

/**
 * Read lines from the captured chat image
 */
async function readChatFromImage(img: a1lib.ImgRefBind): Promise<void> {
    const chatData = chatbox.find(img); // Find chat boxes in the image

    if (!chatData) {
        document.querySelector("#mainTab p").textContent =
            "Could not find chat box.";
        return;
    }

    // Highlight the main chatbox
    if (!mainboxRect) {
        const { x, y, width, height } = chatbox.pos.mainbox.rect;
        alt1.overLayRect(
            a1lib.mixColor(255, 0, 0),
            x,
            y,
            width,
            height,
            2000,
            3,
        );
        mainboxRect = true;
    }

    if (
        document.querySelector("#mainTab p").textContent ===
        "Could not find chat box."
    ) {
        document.querySelector("#mainTab p").innerHTML = previousMainContent;
    }

    let lines = chatbox.read(); // Read lines from the detected chat box
    if (
        (lines.length > 1 &&
            lines.some((line) =>
                line.text.includes("Attempting to switch worlds..."),
            )) ||
        worldHopMessage
    ) {
        let worldNumber = await findWorldNumber(img);
        if (!worldNumber) {
            console.log(
                "Unable to capture world number from Friends List. Make sure the interface is viewable on screen.",
            );
        } else {
            // Save the previous world just in case
            const previousWorld = sessionStorage.getItem("currentWorld");
            if (previousWorld !== worldNumber) {
                sessionStorage.setItem("previousWorld", previousWorld);
                sessionStorage.setItem("currentWorld", worldNumber);
            }
        }
        worldHopMessage = false;
    }
    if (!hasTimestamps)
        lines.some(
            (line) =>
                line.fragments.length > 1 &&
                /\d\d:\d\d:\d\d/.test(line.fragments[1].text),
        )
            ? (hasTimestamps = true)
            : (hasTimestamps = false);

    let combinedText = "";
    let recentTimestamp: null | string = null;
    lastTimestamp = new Date(sessionStorage.getItem("lastTimestamp"));
    lastMessage = sessionStorage.getItem("lastMessage");
    if (lines?.length) {
        // Remove blank lines
        if (lines.some((line) => line.text === ""))
            lines = lines.filter((line) => line.text !== "");

        lines.some((line) =>
            line.text.includes("Attempting to switch worlds..."),
        )
            ? (worldHopMessage = true)
            : (worldHopMessage = false);

        // Remove all messages which are not older than the lastTimestamp
        // Messages will not be sent if there are messages which are sent at the same time!
        if (lastTimestamp)
            lines = lines.filter(
                (line) =>
                    new Date(
                        `${new Date().toLocaleDateString()} ` +
                            line.fragments[1]?.text,
                    ) >= lastTimestamp,
            );

        for (const line of lines) {
            if (line.text === lastMessage) continue;
            lastMessage = line.text;
            sessionStorage.setItem("lastMessage", lastMessage);
            console.log(line);

            const allTextFromLine = line.text;
            combinedText =
                combinedText === ""
                    ? (combinedText += allTextFromLine)
                    : combinedText + " " + allTextFromLine;

            if (hasTimestamps && line.fragments.length > 1)
                recentTimestamp = line.fragments[1].text;
            lastTimestamp =
                new Date(
                    `${new Date().toLocaleDateString()} ` + recentTimestamp,
                ) ?? new Date();
            sessionStorage.setItem("lastTimestamp", String(lastTimestamp));

            // Check if the text contains any keywords from the 'events' object
            const [partialMatch, matchingEvent] = getMatchingEvent(
                combinedText,
                events,
            );

            if (matchingEvent && !partialMatch) {
                const time = line.fragments[1]?.text ?? recentTimestamp;

                // Send the combined text to the server
                const current_world = worldHopMessage
                    ? sessionStorage.getItem("previousWorld")
                    : alt1.currentWorld < 0
                      ? sessionStorage.getItem("currentWorld")
                      : String(alt1.currentWorld);

                if (current_world === null) continue;

                try {
                    const response = await axios.post(
                        "https://i3fhqxgish.execute-api.eu-west-2.amazonaws.com/send_webhook",
                        {
                            headers: {
                                "Content-Type": "application/json",
                                Origin: ORIGIN,
                            },
                            event: matchingEvent,
                            world: current_world,
                            debug: DEBUG,
                        },
                    );

                    const rsn = localStorage.getItem("rsn");
                    addNewEvent({
                        event: matchingEvent,
                        world: current_world,
                        duration: eventTimes[matchingEvent],
                        reportedBy: rsn,
                        timestamp: Date.now(),
                    });

                    // Send timer request to avoid duplicate calls
                    if (response.status === 201) {
                        const eventTime = eventTimes[matchingEvent];
                        const response = await axios.post(
                            "https://i3fhqxgish.execute-api.eu-west-2.amazonaws.com/clear_event_timer",
                            {
                                headers: {
                                    "Content-Type": "application/json",
                                    Origin: ORIGIN,
                                },
                                event: matchingEvent,
                                world: current_world,
                                timeout: eventTime,
                                rsn: rsn,
                            },
                        );

                        if (response.status != 200) {
                            console.log(
                                `There was no ${matchingEvent}_${current_world} in the server cache.`,
                            );
                        }
                    }
                } catch (err) {
                    console.log(err);
                    console.log(
                        `Duplicate event - ignoring ${matchingEvent} on ${current_world}`,
                    );
                }
            } else if (!partialMatch) {
                combinedText = "";
            }
        }
    }
}

/**
 * Initialize the event history update interval.
 * This creates a single interval that refreshes the time left values every second.
 */
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

/**
 * Add a new event to the history and update storage & UI.
 */
export function addNewEvent(newEvent: EventRecord): void {
    eventHistory.push(newEvent);
    saveEventHistory();
    // Append the new row instead of re-rendering everything.
    appendEventRow(newEvent);

    startEventTimerRefresh();
}

/**
 * Append a single event row to the table and store the time left cell reference.
 */
function appendEventRow(event: EventRecord): void {
    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;

    const row = document.createElement("tr");

    const removeTd = document.createElement("td");
    const now = Date.now();
    const elapsed = (now - event.timestamp) / 1000;
    const remaining = event.duration - elapsed;

    if (remaining <= 0) {
        // Create a button that fills the cell
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "X";
        removeBtn.title = "Clear this event";

        // When clicked, remove this event from the table & array
        removeBtn.addEventListener("click", () => {
            removeEvent(event);
        });

        removeTd.appendChild(removeBtn);
    }
    row.appendChild(removeTd);

    const eventTd = document.createElement("td");
    eventTd.textContent = event.event;

    const worldTd = document.createElement("td");
    worldTd.textContent = event.world;

    const timeLeftTd = document.createElement("td");
    timeLeftTd.className = "time-left";
    timeLeftTd.textContent = formatTimeLeft(event);

    const reportedByTd = document.createElement("td");
    reportedByTd.textContent = event.reportedBy || "Unknown";

    row.appendChild(eventTd);
    row.appendChild(worldTd);
    row.appendChild(timeLeftTd);
    row.appendChild(reportedByTd);

    // Add new events to the top of the table
    tbody.insertBefore(row, tbody.firstChild);

    // Use the event's timestamp as a unique key to store the reference.
    timeLeftCells.set(event.timestamp, timeLeftTd);
}

function removeEvent(event: EventRecord): void {
    // 1) Remove from the array
    eventHistory = eventHistory.filter((e) => e.timestamp !== event.timestamp);

    // 2) Save changes
    saveEventHistory();

    // Remove just this row from the DOM
    // find the row in the table
    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;
    const rows = Array.from(tbody.getElementsByTagName("tr"));
    for (const row of rows) {
        // Suppose the second cell is 'Event' which must match
        // or you can store a data attribute for the timestamp
        const cells = row.getElementsByTagName("td");
        if (cells.length > 1 && cells[1].textContent === event.event) {
            tbody.removeChild(row);
            break;
        }
    }
}

/**
 * Load event history from localStorage on page load.
 */
function loadEventHistory(): void {
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

/**
 * Save the current event history to localStorage.
 */
function saveEventHistory(): void {
    localStorage.setItem("eventHistory", JSON.stringify(eventHistory));
}

export function clearEventHistory(): void {
    eventHistory = [];
    saveEventHistory();
    renderEventHistory();
}

/**
 * Render the event history table.
 * This function clears the table and re-renders all rows, and rebuilds the cell reference map.
 */
export function renderEventHistory(): void {
    const tbody = document.getElementById("eventHistoryBody");
    if (!tbody) return;

    // Clear old rows and cell references.
    tbody.innerHTML = "";
    timeLeftCells.clear();

    const hideExpired = (
        document.getElementById("hideExpiredCheckbox") as HTMLInputElement
    )?.checked;
    const now = Date.now();

    const sortedEvents = eventHistory.slice().sort((a, b) => {
        const elapsedA = (now - a.timestamp) / 1000;
        const elapsedB = (now - b.timestamp) / 1000;
        const remainingA = Math.max(0, a.duration - elapsedA);
        const remainingB = Math.max(0, b.duration - elapsedB);

        // If a is active and b is expired, a comes first.
        if (remainingA > 0 && remainingB === 0) return 1;

        // If a is expired and b is active, b comes first.
        if (remainingA === 0 && remainingB > 0) return -1;

        // Otherwise, keep their current order
        return 0;
    });

    // Insert a new row for each event.
    sortedEvents.forEach((event) => {
        const elapsed = (now - event.timestamp) / 1000;
        let remaining = event.duration - elapsed;
        if (remaining < 0) remaining = 0;

        // Skip events which are Expired
        if (hideExpired && remaining <= 0) {
            return;
        }

        appendEventRow(event);
    });
}

/**
 * Update only the "Time Left" cells in the event history.
 */
function updateEventTimers(): void {
    const now = Date.now();

    // Update each event's timer without removing them from eventHistory.
    eventHistory.forEach((event) => {
        const elapsed = (now - event.timestamp) / 1000;
        let remaining = event.duration - elapsed;
        if (remaining < 0) remaining = 0;

        // Update the corresponding time cell, if it exists.
        const timeCell = timeLeftCells.get(event.timestamp);
        if (timeCell) {
            timeCell.textContent = formatTimeLeftValue(remaining);
        }
    });

    // Optionally re-render the entire event history table to remove expired rows:
    renderEventHistory();

    // Check if all events have expired (or if there are no events).
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

/**
 * Helper function to format time left based on an event's stored timestamp.
 */
function formatTimeLeft(event: EventRecord): string {
    const now = Date.now();
    const elapsed = (now - event.timestamp) / 1000;
    let remaining = event.duration - elapsed;
    if (remaining < 0) remaining = 0;
    return formatTimeLeftValue(remaining);
}

/**
 * Helper function to format a given number of seconds.
 */
function formatTimeLeftValue(seconds: number): string {
    if (seconds <= 0) return "Expired";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
}

/**
 * Find the matching event, partial or exact
 */
// Helper function to check if the line contains a keyword from the events object
function getMatchingEvent(
    lineText: string,
    events: Events,
): [boolean, EventKeys | null] {
    // Define the regex pattern to match the time format and remove it if present
    const timeRegex = /^\[\d{2}:\d{2}:\d{2}\]\s*/;
    lineText = lineText.replace(timeRegex, "");

    // Define allowed prefixes and remove them if present
    const prefixes = ["Misty: ", "Fisherman: ", "Guys: "];
    const matchingPrefix = prefixes.find((prefix) =>
        lineText.startsWith(prefix),
    );
    if (matchingPrefix) lineText = lineText.slice(matchingPrefix.length);

    // Accepted: Misty: something -> something \\ Match "something" in the event values
    // Declined: FooBar: something -> FooBar: something \\ Match "FooBar: something" in the event values

    // Check if the lineText matches a phrase in any event
    for (const [eventKey, phrases] of Object.entries(events)) {
        const exactMatch = phrases.find((phrase) => lineText === phrase);
        if (exactMatch) return [false, eventKey as EventKeys];

        const partialMatch = phrases.find((phrase) =>
            phrase.includes(lineText),
        );
        if (partialMatch) return [true, eventKey as EventKeys];
    }

    return [false, null]; // No match found
}

/**
 * Find the current world number in the friend list
 */
const findWorldNumber = async (
    img: a1lib.ImgRefBind,
): Promise<string | undefined> => {
    const imageRef = imgs.runescapeWorldPretext;
    const pos = img.findSubimage(imageRef);
    const buffData: ImageData = img.toData();

    let worldNumber;
    if (pos.length) {
        for (let match of pos) {
            const textObj = OCR.findReadLine(
                buffData,
                font,
                [[255, 155, 0]],
                match.x + 5,
                match.y + 2,
            );
            worldNumber = textObj.text.match(/\d{1,3}/)[0];
        }
    }

    return worldNumber;
};
