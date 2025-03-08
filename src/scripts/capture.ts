import * as a1lib from "alt1";
import ChatBoxReader, { ChatLine } from "alt1/chatbox";
import * as OCR from "alt1/ocr";
import axios from "axios";
import { webpackImages } from "alt1/base";
import font from "alt1/fonts/aa_8px_mono.js";
import { Events, EventKeys, events, eventTimes } from "./events";
import { DEBUG, ORIGIN } from "../config";
import { wsClient } from "./ws";
import {
    loadEventHistory,
    startEventTimerRefresh,
    addNewEvent,
} from "./eventHistory";
import { v4 as uuid } from "uuid";

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
let previousMainContent: string;
let hasTimestamps: boolean;
let lastTimestamp: Date;
let lastMessage: string;

let worldHopMessage = false;
let mainboxRect = false;

function updateMainTab(message: string): void {
    const mainTabParagraph = document.querySelector("#mainTab p");
    if (mainTabParagraph) {
        mainTabParagraph.textContent = message;
    }
}

function checkPermissions(): boolean {
    if (!window.alt1) {
        updateMainTab(
            "You need to run this page in alt1 to capture the screen.",
        );
        return false;
    }
    if (
        !alt1.permissionPixel ||
        !alt1.permissionGameState ||
        !alt1.permissionOverlay
    ) {
        updateMainTab(
            "Page is not installed as an app or permissions are not correct.",
        );
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
    previousMainContent = document.querySelector("#mainTab p")!.innerHTML;
    loadEventHistory();

    const eventHistoryTab = document.getElementById("eventHistoryTab");
    if (eventHistoryTab?.classList.contains("sub-tab__content--active")) {
        startEventTimerRefresh();
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

function detectTimestamps(lines: any[]): boolean {
    return lines.some(
        (line) =>
            line.fragments.length > 1 &&
            /\d\d:\d\d:\d\d/.test(line.fragments[1].text),
    );
}

function processLine(
    line: ChatLine,
    combinedText: string,
    hasTimestamps: boolean,
): {
    newCombinedText: string;
    updatedTimestamp: Date;
    updatedLastMessage: string;
} {
    // Append current line text to combinedText
    const newCombinedText =
        combinedText === "" ? line.text : combinedText + " " + line.text;
    let updatedTimestamp = new Date();
    if (hasTimestamps && line.fragments.length > 1) {
        const recentTimestamp = line.fragments[1].text;
        updatedTimestamp = new Date(
            `${new Date().toLocaleDateString()} ${recentTimestamp}`,
        );
    }
    return {
        newCombinedText,
        updatedTimestamp,
        updatedLastMessage: line.text,
    };
}

async function reportEvent(
    matchingEvent: EventKeys,
    current_world: string,
): Promise<void> {
    try {
        const rsn = localStorage.getItem("rsn");
        const sendWebhookResponse = await axios.post(
            "https://api.dsfeventtracker.com/send_webhook",
            {
                headers: {
                    "Content-Type": "application/json",
                    Origin: ORIGIN,
                },
                event: matchingEvent,
                world: current_world,
                debug: DEBUG,
                reportedBy: rsn,
            },
        );

        const eventId = uuid();
        addNewEvent({
            id: eventId,
            type: "addEvent",
            event: matchingEvent,
            world: current_world,
            duration: eventTimes[matchingEvent] + 6,
            reportedBy: rsn,
            timestamp: Date.now(),
            oldEvent: null,
        });

        if (sendWebhookResponse.status !== 200) {
            console.log("Did not receive the correct response");
            return;
        }

        const eventTime = eventTimes[matchingEvent];
        const clearEventTimerResponse = await axios.post(
            "https://api.dsfeventtracker.com/clear_event_timer",
            {
                headers: {
                    "Content-Type": "application/json",
                    Origin: ORIGIN,
                },
                event: matchingEvent,
                world: current_world,
                timeout: eventTime,
            },
        );

        if (
            clearEventTimerResponse.status === 200 &&
            clearEventTimerResponse.data.message ===
                "Event successfully removed"
        ) {
            wsClient.send({
                id: eventId,
                type: "addEvent",
                event: matchingEvent,
                world: current_world,
                duration: eventTime,
                reportedBy: rsn,
                timestamp: Date.now(),
                oldEvent: null,
            });
        }
    } catch (err) {
        console.log(err);
        console.log(
            `Duplicate event - ignoring ${matchingEvent} on ${current_world}`,
        );
    }
}

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
        // Only happens when there has been a world hop
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

    // Checks on every image captured whether there are timestamps in chat
    // Every image capture in case a user decides to turn it on/off
    hasTimestamps = detectTimestamps(lines);

    let combinedText = "";
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
        // Keeps messages which are cut onto 2 lines
        if (lastTimestamp)
            lines = lines.filter(
                (line) =>
                    new Date(
                        `${new Date().toLocaleDateString()} ` +
                            line.fragments[1]?.text,
                    ) >= lastTimestamp || line.fragments[1]?.text === undefined,
            );

        for (const line of lines) {
            if (line.text === lastMessage) continue;
            const { newCombinedText, updatedTimestamp, updatedLastMessage } =
                processLine(line, combinedText, hasTimestamps);
            combinedText = newCombinedText;
            lastMessage = updatedLastMessage;
            sessionStorage.setItem("lastMessage", lastMessage);
            console.log(line);

            lastTimestamp = updatedTimestamp;
            sessionStorage.setItem("lastTimestamp", String(lastTimestamp));

            // Check if the text contains any keywords from the 'events' object
            const [partialMatch, matchingEvent] = getMatchingEvent(
                combinedText,
                events,
            );

            if (matchingEvent && !partialMatch) {
                // Send the combined text to the server
                const current_world = worldHopMessage
                    ? sessionStorage.getItem("previousWorld")
                    : alt1.currentWorld < 0
                      ? sessionStorage.getItem("currentWorld")
                      : String(alt1.currentWorld);

                if (current_world === null) continue;
                console.log(
                    `'Current world': ${current_world}`,
                    `Previous world: ${sessionStorage.getItem("previousWorld")}`,
                    `Alt1 detected world: ${alt1.currentWorld}`,
                    `Current world (ss): ${sessionStorage.getItem("currentWorld")}`,
                );
                await reportEvent(matchingEvent, current_world);
            } else if (!partialMatch) {
                combinedText = "";
            }
        }
    }
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
