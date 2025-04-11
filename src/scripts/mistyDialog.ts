import DialogReader from "alt1/dialog";
import { EventKeys, EventRecord, eventTimes } from "./events";
import * as a1lib from "alt1";
import * as OCR from "alt1/ocr";
import { currentWorld, reportEvent, findWorldNumber } from "./capture";
import { API_URL, ORIGIN } from "../config";
import axios, { AxiosError } from "axios";
import { showToast } from "./notifications";
import fontmono2 from "alt1/fonts/chatbox/12pt.js";
import { wsClient } from "./ws";

type TimerData = {
    seconds: number;
    status: "active" | "inactive";
    eventName: EventKeys | null;
};

let mistyInterval: NodeJS.Timeout | null;

// Initialize the DialogReader
const reader = new DialogReader();

export function startCapturingMisty(): void {
    if (mistyInterval) return; // already running
    mistyInterval = setInterval(readTextFromDialogBox, 1000);
}

function stopCapturingMisty(): void {
    if (mistyInterval) {
        clearInterval(mistyInterval);
        mistyInterval = null;
        console.log("Misty dialog capturing stopped. It will resume on a world hop.");
    }
}

// Function to parse time strings into total seconds
function parseTimeToSeconds(input: string): number {
    const regex = /(\d+)\s*(hour|minute|second)s?/gi;
    let totalSeconds = 0;

    for (const match of input.matchAll(regex)) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        if (unit === "hour") totalSeconds += value * 3600;
        else if (unit === "minute") totalSeconds += value * 60;
        else if (unit === "second") totalSeconds += value;
    }

    return totalSeconds;
}

function getValidEventNames(): EventKeys[] {
    return Object.keys(eventTimes).filter((key): key is EventKeys => key !== "Testing" && key !== "Unknown");
}

function reReadDialogBox(): string {
    const pos = reader.pos;
    const imgref = a1lib.captureHold(pos!.x!, pos!.y!, pos!.width!, pos!.height!);
    const buf = imgref.toData(pos!.x!, pos!.y! + 33, pos!.width!, 80);
    const lines = [];
    let chr = null;
    for (let y = 0; y < buf.height; y++) {
        let hastext = false;
        for (let x = 200; x < 300; x++) {
            let i = x * 4 + y * 4 * buf.width;
            if (buf.data[i] + buf.data[i + 1] + buf.data[i + 2] < 50) {
                hastext = true;
                break;
            }
        }
        if (hastext) {
            chr = chr || OCR.findChar(buf, fontmono2, [0, 0, 0], 192, y + 5, 12, 3);
            chr = chr || OCR.findChar(buf, fontmono2, [0, 0, 0], 246, y + 5, 12, 3);
            chr = chr || OCR.findChar(buf, fontmono2, [0, 0, 0], 310, y + 5, 12, 3);
            if (chr) {
                let read = OCR.readLine(buf, fontmono2, [0, 0, 0], chr.x, chr.y, true, true);
                if (read.text.length >= 3) {
                    lines.push(read.text);
                }
                y = chr.y + 5;
                break;
            }
        }
    }
    let newLine = "";
    // Loop through x until a match
    for (let xi = 0; xi < 100; xi++) {
        // +16 on y seems to fit the line below the captured line.
        const textLine = OCR.readLine(buf, fontmono2, [0, 0, 0], chr!.x! + xi, chr!.y! + 16, true, true).text;
        if (textLine.match(/\b(\d+)\s*minutes?\s*and\s*(\d+)\s*seconds?\b/)) {
            newLine = textLine;
            break;
        }
    }
    return newLine;
}

async function updateTimersFromMisty(timerData: TimerData): Promise<void> {
    if (!timerData) {
        showToast("Misty time not updated - failed reading dialog", "error");
        console.log("Misty time not updated - failed reading dialog");
        return;
    }
    const { seconds, status, eventName } = timerData;

    const world =
        Number(currentWorld) === alt1.currentWorld && alt1.currentWorld > 0
            ? currentWorld
            : alt1.currentWorld > 0
              ? String(alt1.currentWorld)
              : sessionStorage.getItem("currentWorld")
                ? sessionStorage.getItem("currentWorld")
                : await findWorldNumber(a1lib.captureHoldFullRs());

    if (!world) {
        showToast("Misty time not updated - world not found.", "error");
        console.log("Misty time not updated - world not found.");
        return stopCapturingMisty();
    }
    stopCapturingMisty();

    const newDuration = eventTimes[eventName ?? "Unknown"] - seconds;
    try {
        const event = await axios.get(`${API_URL}/worlds/${world}/event`);

        // Active check
        if (event.data && event.data.message) {
            await axios.patch(`${API_URL}/worlds/${world}/event?type=${status}&seconds=${seconds}`, {
                headers: {
                    "Content-Type": "application/json",
                    Origin: ORIGIN,
                },
            });
            const activeEventStatus = event.data.message[0];
            const eventRecord = JSON.parse(activeEventStatus.event_record);
            const mistyEditEvent: EventRecord = { ...eventRecord };
            mistyEditEvent.token = localStorage.getItem("accessToken") ?? "";
            mistyEditEvent.type = "editEvent";
            mistyEditEvent.duration = newDuration;
            mistyEditEvent.timestamp = Date.now();
            mistyEditEvent.oldEvent = eventRecord;

            wsClient.send(mistyEditEvent);
        }
        showToast(`Misty time updated for world ${world}`);
        console.log(`Misty time updated for world ${world}`);
    } catch (err) {
        const axiosErr = err as AxiosError;

        if (axiosErr.response?.status === 404 && status === "active") {
            // Misty says it's active, but no active event is known → create it
            const newDuration = eventTimes[eventName ?? "Unknown"] - seconds;
            await reportEvent(eventName ?? "Unknown", false, world, { duration: newDuration });
            showToast(`Event added from Misty on world ${world}`);
            console.log(`Event added from Misty on world ${world}`);
        } else if (axiosErr.response?.status === 404 && status === "inactive") {
            // Misty says it's inactive, and no event exists → just update the timer
            await axios.patch(`${API_URL}/worlds/${world}/event?type=${status}&seconds=${seconds}`, {
                headers: {
                    "Content-Type": "application/json",
                    Origin: ORIGIN,
                },
            });
            showToast(`Misty time updated for world ${world}`);
            console.log(`Misty time updated for world ${world}`);
        } else {
            console.error("Unhandled error from world event:", axiosErr);
        }
    }
}

export async function readTextFromDialogBox(): Promise<null> {
    if (reader.find()) {
        const dialogReadable = reader.read();
        if (!dialogReadable || !dialogReadable.text) {
            showToast("Unable to read Misty dialog", "error");
            return null;
        }

        if (dialogReadable.title.toLowerCase() === "misty" && dialogReadable.text.length === 1) {
            // Incomplete read
            let newLine = "";
            try {
                newLine = reReadDialogBox();
            } catch (err) {
                console.log("Unable to capture text from dialog");
                showToast("Unable to capture text from dialog", "error");
                stopCapturingMisty();
                return null;
            }
            dialogReadable.text.push(newLine);
        }

        const dialogText = dialogReadable.text.join(" ");
        const seconds = parseTimeToSeconds(dialogText);
        if (!seconds) return null;

        const eventName = getValidEventNames().find((event) => dialogText.includes(event)) ?? null;

        const status: "active" | "inactive" = eventName ? "active" : "inactive";

        if (dialogReadable.title.toLowerCase() === "misty" && mistyInterval) {
            const color = a1lib.mixColor(255, 0, 0);
            alt1.overLayRect(color, reader.pos?.x!, reader.pos?.y!, reader.pos?.width!, reader.pos?.height!, 2000, 1);
            await updateTimersFromMisty({ seconds, status, eventName });
        }

        return null;
    } else {
        return null;
    }
}
