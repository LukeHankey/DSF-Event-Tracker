import * as a1lib from "alt1";
import ChatBoxReader, { ChatLine } from "alt1/chatbox";
import * as OCR from "alt1/ocr";
import axios, { AxiosError } from "axios";
import { webpackImages } from "alt1/base";
import font from "alt1/fonts/aa_8px_mono.js";
import { EventKeys, events, eventTimes, firstEventTexts, eventExpiredText, EventRecord } from "./events";
import { DEBUG, API_URL } from "../config";
import { wsClient, refreshToken } from "./ws";
import { loadEventHistory, startEventTimerRefresh } from "./eventHistory";
import { v4 as uuid } from "uuid";
import Fuse from "fuse.js";
import { decodeJWT } from "./permissions";
import { showToast } from "./notifications";
import { renderMistyTimers, startMistyimerRefresh } from "./mistyTimers";
import { startCapturingMisty } from "./mistyDialog";
import { setDefaultTitleBar } from "./notifications";

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
/* eslint-disable @typescript-eslint/no-require-imports */
const imgs = webpackImages({
    runescapeWorldPretext: require("../assets/runescape_world_pretext.data.png"),
});

/**
 * Internal state variables
 */
let captureInterval: NodeJS.Timeout | null;
let previousMainContent: string;
let hasTimestamps: boolean;
let lastTimestamp: Date;
let lastMessage: string;
let maxBasey: number = 0;
export let currentWorld: string | null = null;

let worldHopMessage = false;
let mainboxRect = false;

function updateMainTab(message: string): void {
    const mainTabHeader = document.querySelector("#mainTab h2");
    if (mainTabHeader) {
        mainTabHeader.textContent = message;
    }
}

function checkPermissions(): boolean {
    if (!window.alt1) {
        updateMainTab("You need to run this page in alt1 to capture the screen.");
        return false;
    }
    if (!alt1.permissionPixel || !alt1.permissionGameState || !alt1.permissionOverlay) {
        updateMainTab("Page is not installed as an app or permissions are not correct.");
        return false;
    }
    return true;
}

export function capture(): void {
    if (!checkPermissions()) return;
    try {
        const img = a1lib.captureHoldFullRs();
        readChatFromImage(img);
    } catch (err) {
        console.log("Failed to capture screen:", err);
    }
}

function getCaptureFrequency(): number {
    const freq = localStorage.getItem("captureFrequency");
    return freq ? parseInt(freq) || 2 : 2;
}

export function initCapture(): void {
    if (localStorage.getItem("captureFrequency") == null) {
        localStorage.setItem("captureFrequency", "2");
    }
    previousMainContent = document.querySelector("#mainTab h2")!.innerHTML;
    loadEventHistory();
    renderMistyTimers();

    const notificationModes = JSON.parse(localStorage.getItem("notificationModes") ?? "[]");
    if (notificationModes && notificationModes.includes("toolbar")) {
        setDefaultTitleBar();
    } else {
        alt1.setTitleBarText("");
    }

    const eventHistoryTab = document.getElementById("eventHistoryTab");
    if (eventHistoryTab?.classList.contains("sub-tab__content--active")) {
        startEventTimerRefresh();
    }

    const mistyTab = document.getElementById("mistyTimersTab");
    if (mistyTab?.classList.contains("sub-tab__content--active")) {
        startMistyimerRefresh();
    }
}

export function startCapturing(): void {
    if (captureInterval) return; // already running
    captureInterval = setInterval(capture, getCaptureFrequency() * 1000);
}

export function stopCapturing(): void {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
}

function detectTimestamps(lines: ChatLine[]): boolean {
    return lines.some((line) => line.fragments.length > 1 && /\d\d:\d\d:\d\d/.test(line.fragments[1].text));
}

async function addEventCount(matchingEvent: EventKeys, isFirstEvent: boolean) {
    const token = localStorage.getItem("accessToken");
    if (token) {
        const discordID = decodeJWT(token)?.discord_id;
        try {
            const addCountResponse = await axios.patch(
                `${API_URL}/profiles/${discordID}`,
                {
                    key: isFirstEvent ? "alt1First" : "alt1",
                    event: matchingEvent,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (addCountResponse.status === 200) {
                console.log(`${matchingEvent} has been added to call count.`);
            } else {
                console.error(`Status not 200 for adding event count: ${addCountResponse}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(error);
                const status = error.response?.status;
                const message = error.response?.data?.detail;
                if (status === 401 && message === "Token has expired") {
                    await refreshToken();
                    await addEventCount(matchingEvent, isFirstEvent);
                } else {
                    return showToast(message, "error");
                }
            } else {
                console.error("Unexpected error", error);
            }
        }
    }
}

function processLine(
    line: ChatLine,
    hasTimestamps: boolean,
): {
    updatedTimestamp: Date;
    updatedLastMessage: string;
} {
    let updatedTimestamp = new Date();
    if (hasTimestamps && line.fragments.length > 1) {
        const recentTimestamp = line.fragments[1].text;
        updatedTimestamp = new Date(`${new Date().toLocaleDateString()} ${recentTimestamp}`);
    }
    return {
        updatedTimestamp,
        updatedLastMessage: line.text,
    };
}

export async function reportEvent(
    matchingEvent: EventKeys,
    isFirstEvent: boolean,
    currentWorld: string,
    overrides: Partial<EventRecord> = {},
): Promise<void> {
    const rsn = localStorage.getItem("rsn") ?? sessionStorage.getItem("rsn") ?? "";
    const token = localStorage.getItem("accessToken");
    const eventId = uuid();
    const eventKey = matchingEvent === "Travelling merchant" ? "merchantCount" : "otherCount";
    const profileEventKey = `${isFirstEvent ? "alt1First" : "alt1"}.${eventKey}`;
    const eventRecord: EventRecord = {
        id: eventId,
        type: "addEvent",
        event: matchingEvent,
        world: currentWorld,
        duration: eventTimes[matchingEvent] + 6,
        reportedBy: rsn,
        timestamp: Date.now(),
        oldEvent: null,
        token: token,
        source: "alt1",
        profileEventKey,
        mistyUpdate: false,
        ...overrides,
    };

    try {
        const sendWebhookResponse = await axios.post(
            `${API_URL}/events/webhook`,
            {
                eventRecord,
                isFirstEvent,
                debug: DEBUG,
                reportedBy: rsn,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );

        // Check that the event is seen spawning and they have verified discord ID
        // May change in future to add another setting to track count but for now
        // I will track all that have been verified
        await addEventCount(matchingEvent, isFirstEvent);

        if (sendWebhookResponse.status !== 200) {
            console.log("Did not receive the correct response");
            return;
        }

        wsClient.send(eventRecord);

        const eventWorld = `${matchingEvent}_${currentWorld}`;
        const clearEventTimerResponse = await axios.post(
            `${API_URL}/events/clear_timer?event_world=${eventWorld}&timeout=${eventRecord.duration}`,
            {},
            {
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );

        if (
            clearEventTimerResponse.status === 200 &&
            clearEventTimerResponse.data.message === "Event successfully removed"
        ) {
            console.log(
                `${matchingEvent} on world ${currentWorld} has been queued for ${eventRecord.duration} seconds.`,
            );
        }
    } catch (err) {
        if ((err as AxiosError).status === 409) {
            const error = err as AxiosError<{ is_first_event?: boolean }>;
            console.log(`Duplicate event - ignoring ${matchingEvent} on ${currentWorld}`);
            // Happens if there are multiple people on same world. Only one will send the webhook
            // Others will get a 409.
            if (error.response?.data.is_first_event) {
                await addEventCount(matchingEvent, error.response?.data.is_first_event);
            }
            return;
        }
        console.log(err);
    }
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function readChatFromImage(img: a1lib.ImgRefBind): Promise<void> {
    const chatData = chatbox.find(img); // Find chat boxes in the image

    if (!chatData) {
        updateMainTab("Could not find chat box.");
        const futureTime = new Date(new Date().getTime() + 5000);
        sessionStorage.setItem("lastTimestamp", String(futureTime));
        return;
    }

    // Highlight the main chatbox
    if (!mainboxRect) {
        const mainbox = chatbox.pos!.mainbox;
        const { x, y, width, height } = mainbox.rect;
        alt1.overLayRect(a1lib.mixColor(255, 0, 0), x, y, width, height, 2000, 1);
        mainboxRect = true;

        const rsnRect = {
            x: mainbox.rect.x,
            y: mainbox.botleft.y - 10,
            width: mainbox.botleft.x - mainbox.rect.x,
            height: 23,
        };

        const buffer = img.toData();
        const chr = OCR.findChar(buffer, font, [255, 255, 255], rsnRect.x, rsnRect.y, rsnRect.width, rsnRect.height);
        let data;
        // Lifeguard title
        if (chr && ["e", "g", "u"].includes(chr.chr) && chr.x === rsnRect.x + 25) {
            data = OCR.findReadLine(
                buffer,
                font,
                [[255, 255, 255]],
                rsnRect.x + 50,
                rsnRect.y,
                rsnRect.width,
                rsnRect.height,
            );
        } else {
            data = OCR.findReadLine(
                buffer,
                font,
                [[255, 255, 255]],
                rsnRect.x,
                rsnRect.y,
                rsnRect.width,
                rsnRect.height,
            );
        }
        const valkTitle = " of the Valkyrie";
        if (data.text.includes(valkTitle)) data.text = data.text.replace(valkTitle, "");
        if (["!", ","].some((char) => data.text.includes(char))) data.text = data.text.replace(/[!,]/g, "");

        if (data.text !== "") {
            alt1.overLayRect(
                a1lib.mixColor(0, 255, 0),
                data.debugArea.x,
                data.debugArea.y,
                data.debugArea.w,
                data.debugArea.h,
                2000,
                1,
            );
            console.log(`Captured RSN: ${data.text}`);
            sessionStorage.setItem("rsn", data.text);
        } else {
            console.log("Failed to capture RSN");
        }

        // Get current world when alt1 app first loads
        currentWorld = alt1.currentWorld > 0 ? String(alt1.currentWorld) : await findWorldNumber(img);
        await startCapturingMisty({ startWorker: true });

        console.log("Looking up world number for the first time: ", currentWorld);
    }

    if (document.querySelector("#mainTab h2")!.textContent === "Could not find chat box.") {
        document.querySelector("#mainTab h2")!.innerHTML = previousMainContent;
    }

    let lines: ChatLine[] = [];
    try {
        lines = (chatbox.read() as ChatLine[])?.filter((line) => line.text) ?? []; // Read lines from the detected chat box
    } catch {
        // TypeError: Cannot read property 'width' of null
        return;
    }

    const lastGameTimestamp = lines.slice(-1)[0]?.fragments[1]?.text;
    worldHopMessage = lines.some(
        (line) =>
            line.text.includes("Attempting to switch worlds...") ||
            line.text.includes("Attempting to change worlds..."),
    );
    if (worldHopMessage) {
        worldHopMessage = false;
        console.log("alt1.currentWorld after world hop and before delay: ", alt1.currentWorld);
        await delay(6000);
        console.log("alt1.currentWorld after world hop and after delay: ", alt1.currentWorld);
        currentWorld = alt1.currentWorld > 0 ? String(alt1.currentWorld) : await findWorldNumber(img);
        await startCapturingMisty();

        if (currentWorld && Number(currentWorld) > 0) {
            console.log("World hop message detected and found world number: ", currentWorld);
            const previousWorld = sessionStorage.getItem("currentWorld");
            if (previousWorld !== String(currentWorld)) {
                sessionStorage.setItem("previousWorld", previousWorld ?? "");
                sessionStorage.setItem("currentWorld", currentWorld);
            }
        } else {
            console.log("Unable to capture world number.");
            sessionStorage.removeItem("currentWorld");
        }
        // After a world hop, don't process any lines and have a 5 second delay for any new ones
        lines = [];
        const futureTime = new Date(Number(new Date(`${new Date().toLocaleDateString()} ${lastGameTimestamp}`)) + 5000);
        sessionStorage.setItem("lastTimestamp", String(futureTime));
    }

    // Check before as a new line may not have timestamps but previous ones will
    // Address a random edge case where the OCR reader reads a partial previous line
    // which might match to an event
    if (hasTimestamps) {
        // If a lines basey is > 100 pixels out, then it is too far from the bottom
        // of the chatbox (where new lines are read) so is probably a misread
        // Allow 100 pixel distance for multiline text
        lines = lines.filter((line) => line.basey > maxBasey - 100);
    }

    // Checks on every image captured whether there are timestamps in chat
    // Every image capture in case a user decides to turn it on/off
    hasTimestamps = detectTimestamps(lines);

    let endingEvent: string | null = null;

    for (const line of lines) {
        const result = matchesEventEnd(line.text);
        if (result) {
            endingEvent = result;
            break;
        }
    }

    if (endingEvent) {
        if (hasTimestamps) {
            // Set the lastTimestamp if an event has ended so that chat lines after the last one are read
            lastTimestamp = new Date(`${new Date().toLocaleDateString()} ${lastGameTimestamp}`);
        } else {
            lastTimestamp = new Date();
        }
        sessionStorage.setItem("lastTimestamp", String(lastTimestamp));

        const eventHistory = JSON.parse(localStorage.getItem("eventHistory") ?? "[]");
        if (!currentWorld) return;

        const eventRecordEnding = eventHistory
            .slice(-10)
            .find((event: EventRecord) => event.world === currentWorld && event.event === endingEvent) as EventRecord;
        const eventToEnd: EventRecord = { ...eventRecordEnding };

        const token = localStorage.getItem("accessToken");
        eventToEnd.token = token ?? "";
        eventToEnd.type = "editEvent";
        eventToEnd.duration = 0;
        eventToEnd.timestamp = Date.now();
        eventToEnd.oldEvent = eventRecordEnding;
        eventToEnd.source = "alt1";
        eventToEnd.mistyUpdate = true; // Makes sure the discord call is edited
        wsClient.send(eventToEnd);

        return;
    }

    // For fresh client, capture first new message within 3 seconds
    lastTimestamp = new Date(sessionStorage.getItem("lastTimestamp") ?? Date.now() - 3_000);
    lastMessage = sessionStorage.getItem("lastMessage") ?? "";
    if (lines?.length) {
        // Remove all messages which are not older than the lastTimestamp
        // Messages will not be sent if there are messages which are sent at the same time!
        // Keeps messages which are cut onto 2 lines
        if (lastTimestamp) {
            lines = lines.filter(
                (line) =>
                    new Date(`${new Date().toLocaleDateString()} ` + line.fragments[1]?.text) >= lastTimestamp ||
                    line.fragments[1]?.text === undefined,
            );
        }
        // Filter out the lines which just have a timestamp and optional space
        lines = lines.filter((line) => !/^\[\d{2}:\d{2}:\d{2}\]\s*\S\W?$/.test(line.text));

        for (const line of lines) {
            if (line.basey > maxBasey) maxBasey = line.basey;
            if (line.text === lastMessage) continue;
            const { updatedTimestamp, updatedLastMessage } = processLine(line, hasTimestamps);

            lastMessage = updatedLastMessage;
            sessionStorage.setItem("lastMessage", lastMessage);
            console.log(line);

            lastTimestamp = updatedTimestamp;
            sessionStorage.setItem("lastTimestamp", String(lastTimestamp));

            // Match the event with tolerance. Should work for lines with at least 15 characters
            const [matchingEvent, isFirstEvent] = getMatchingEvent(line.text);
            if (matchingEvent) {
                console.log(
                    `'Current world': ${currentWorld}`,
                    `Alt1 detected world: ${alt1.currentWorld}`,
                    `Current world (ss): ${sessionStorage.getItem("currentWorld")}`,
                    `Previous world (ss): ${sessionStorage.getItem("previousWorld")}`,
                );
                currentWorld =
                    Number(currentWorld) === alt1.currentWorld
                        ? currentWorld
                        : alt1.currentWorld > 0
                          ? String(alt1.currentWorld)
                          : sessionStorage.getItem("currentWorld");
                if (currentWorld === null) {
                    console.log("Attempting to find world number from Friends List...");
                    const potentialWorldNumber = await findWorldNumber(img);
                    if (!potentialWorldNumber) {
                        console.log("Unable to find world number. Please open your Friends List.");
                        continue;
                    }
                    console.log(`Found world number to be ${potentialWorldNumber}.`);
                    currentWorld = potentialWorldNumber;
                }
                if (matchingEvent === "Testing" && !DEBUG) {
                    console.log(`ERROR: Event is Testing in production. ${line} | ${DEBUG}`);
                    continue;
                }
                await reportEvent(matchingEvent, isFirstEvent, currentWorld);
            }
        }
    }
}

// Convert events object into an array for Fuse.js
const eventEntries = Object.entries(events).flatMap(([event, texts]) => texts.map((text) => ({ event, text })));

// Initialize Fuse.js
const fuse = new Fuse(eventEntries, {
    keys: ["text"],
    includeScore: true,
    threshold: 0.3, // Adjust for fuzzy tolerance
    ignoreLocation: true,
    minMatchCharLength: 10,
});

function isLikelyEventStart(lineText: string): boolean {
    const firstTextFuse = new Fuse(firstEventTexts, {
        includeScore: true,
        threshold: 0.3, // Allow minor OCR errors
        ignoreLocation: true,
        minMatchCharLength: 10,
    });

    const results = firstTextFuse.search(lineText);
    return results.length > 0 && results[0].score! <= 0.3; // Acceptable match
}

function getMatchingEvent(lineText: string): [EventKeys | null, boolean] {
    // Remove timestamps if present
    const timeRegex = /^\[\d{2}:\d{2}:\d{2}\]\s*/;
    lineText = lineText.replace(timeRegex, "");

    // Remove certain prefixes if present
    const names = ["Misty", "Fisherman", "Guys", "5Ftx"];
    // OCR can read ":" as ";"
    const prefixRegex = new RegExp(`^(${names.join("|")})[:;]\\s*`);

    const prefixMatch = lineText.match(prefixRegex);
    if (prefixMatch) lineText = lineText.slice(prefixMatch[0].length);

    if (!prefixMatch && !isLikelyEventStart(lineText)) {
        return [null, false]; // Ignore non-valid starting lines
    }

    // Run fuzzy search
    const results = fuse.search(lineText);

    if (results.length > 0) {
        const bestMatch = results[0];
        let eventKey = bestMatch.item.event as EventKeys;
        const eventText = firstEventTexts.includes(bestMatch.item.text);

        if ("has appeared at the hub!" === lineText) {
            if (!eventKey.toLowerCase().includes(lineText)) eventKey = "Unknown";
        }

        return [eventKey, eventText];
    }

    return [null, false]; // No match found
}

const expiredEntries = Object.entries(eventExpiredText).flatMap(([event, texts]) =>
    texts.map((text) => ({ event, text })),
);

const expiredFuse = new Fuse(expiredEntries, {
    keys: ["text"],
    includeScore: true,
    threshold: 0.3,
    ignoreLocation: true,
    minMatchCharLength: 10,
});

function matchesEventEnd(lineText: string): string | null {
    // Strip timestamp from beginning if present
    const timeRegex = /^\[\d{2}:\d{2}:\d{2}\]\s*/;
    lineText = lineText.replace(timeRegex, "");

    const results = expiredFuse.search(lineText);

    if (results.length > 0 && results[0].score! <= 0.3) {
        return results[0].item.event;
    }

    return null;
}

/**
 * Find the current world number in the friend list
 */
export const findWorldNumber = async (img: a1lib.ImgRefBind): Promise<string | null> => {
    const imageRef = imgs.runescapeWorldPretext;
    const pos = img.findSubimage(imageRef);
    const buffData: ImageData = img.toData();

    let worldNumber = null;
    if (pos.length) {
        for (const match of pos) {
            const textObj = OCR.findReadLine(buffData, font, [[255, 155, 0]], match.x + 5, match.y + 2);
            worldNumber = textObj.text.match(/\d{1,3}/)![0];
        }
    }

    return worldNumber;
};
