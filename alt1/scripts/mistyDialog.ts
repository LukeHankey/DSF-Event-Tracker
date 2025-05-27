import DialogReader from "alt1/dialog";
import { EventKeys, EventRecord, eventTimes } from "./events";
import * as a1lib from "alt1";
import { currentWorld, reportEvent, findWorldNumber } from "./capture";
import { API_URL, ORIGIN } from "../config";
import axios, { AxiosError } from "axios";
import { showToast } from "./notifications";
import { wsClient } from "./ws";
import { createWorker, Worker } from "tesseract.js";

type TimerData = {
    seconds: number;
    status: "active" | "inactive";
    eventName: EventKeys | null;
};

export interface WorldRecord {
    world: number;
}

let mistyInterval: NodeJS.Timeout | null;

// Initialize the DialogReader
const reader = new DialogReader();
let worker: Worker | null = null;

async function setupWorker() {
    if (!worker) {
        worker = await createWorker("eng", 1, {
            workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js",
            corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core.wasm.js",
        });
    }
}

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

async function updateTimersFromMisty(timerData: TimerData): Promise<void> {
    if (!timerData) {
        showToast("Misty time not updated - failed reading dialog", "error");
        console.log("Misty time not updated - failed reading dialog");
        return;
    }
    const { seconds, status, eventName } = timerData;

    const world =
        Number(currentWorld) === alt1.currentWorld
            ? currentWorld
            : alt1.currentWorld > 0
              ? String(alt1.currentWorld)
              : await findWorldNumber(a1lib.captureHoldFullRs());

    if (!world || world === "-1") {
        showToast("Misty time not updated - world not found.", "error");
        console.log("Misty time not updated - world not found.");
        return stopCapturingMisty();
    }
    stopCapturingMisty();

    const newDuration = eventTimes[eventName ?? "Unknown"] - seconds;
    try {
        const token = localStorage.getItem("accessToken");
        const event = await axios.get(`${API_URL}/worlds/${world}/event`, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        // Active check
        if (event.data && event.data.message) {
            const activeEventStatus = event.data.message[0];
            const eventRecord = JSON.parse(activeEventStatus.event_record);
            const mistyEditEvent: EventRecord = { ...eventRecord };
            mistyEditEvent.token = token ?? "";
            mistyEditEvent.type = "editEvent";
            mistyEditEvent.duration = status === "active" ? newDuration : 0;
            mistyEditEvent.timestamp = Date.now();
            mistyEditEvent.oldEvent = eventRecord;
            mistyEditEvent.mistyUpdate = true;

            wsClient.send(mistyEditEvent);

            await axios.patch(`${API_URL}/worlds/${world}/event?type=${status}&seconds=${newDuration}`, {
                headers: {
                    "Content-Type": "application/json",
                    Origin: ORIGIN,
                },
            });
        }
        showToast(`Misty time updated for world ${world}`);
        console.log(`Misty time updated for world ${world}`);
    } catch (err) {
        const axiosErr = err as AxiosError<{ detail?: string }>;

        if (axiosErr.response?.status === 404 && status === "active") {
            // Make sure that if an event is being called, it has some time left
            if (seconds <= 0) return;
            // Misty says it's active, but no active event is known → create it
            await reportEvent(eventName ?? "Unknown", false, world, { duration: newDuration, mistyUpdate: true });
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

            wsClient.send({ world: Number(world) } as WorldRecord);
            showToast(`Misty time updated for world ${world}`);
            console.log(`Misty time updated for world ${world}`);
        } else {
            console.error("Unhandled error from world event:", axiosErr);
        }
    }
}

export async function readTextFromDialogBox(): Promise<void> {
    await setupWorker();
    if (reader.find()) {
        try {
            const dialogReadable = reader.read();
            if (!dialogReadable || !dialogReadable.text) {
                showToast("Unable to read Misty dialog", "error");
                stopCapturingMisty();
                return;
            }

            if (!reader.pos) {
                console.error("reader.pos is undefined");
                return;
            }

            if (
                dialogReadable.title.toLowerCase() === "misty" &&
                dialogReadable.text.length === 1 &&
                !dialogReadable.text[0].endsWith(".")
            ) {
                // Incomplete read
                let newLine = "";
                try {
                    const pos = reader.pos;
                    const imgref = a1lib.captureHold(pos.x, pos.y, pos.width, pos.height);
                    const alt1ImageData = imgref.toData().toPngBase64();

                    const {
                        data: { text },
                    } = await worker!.recognize(`data:image/png;base64,${alt1ImageData}`);
                    newLine = text.trim();
                } catch {
                    showToast("Unable to capture text from dialog", "error");
                    stopCapturingMisty();
                    return;
                }
                dialogReadable.text.push(newLine);
            }

            const dialogText = dialogReadable.text.join(" ");

            if (dialogReadable.title.toLowerCase() !== "misty") return;

            const seconds = parseTimeToSeconds(dialogText);
            if (!seconds || seconds < 0) {
                stopCapturingMisty();
                console.error(`Text=${dialogText}, Seconds=${seconds}`);
                return showToast("Unable to parse the time", "error");
            }

            // Misty reports Sea Monster as Sea monster. Lower all text
            let eventName = getValidEventNames().find((event) =>
                dialogText.toLowerCase().includes(event.toLowerCase()),
            );

            const status: "active" | "inactive" = eventName ? "active" : "inactive";
            eventName ??= "Unknown";

            if (mistyInterval) {
                const color = a1lib.mixColor(255, 0, 0);
                alt1.overLayRect(color, reader.pos.x, reader.pos.y, reader.pos.width, reader.pos.height, 2000, 1);
                console.log(`Misty: ${dialogText} | ${status} | ${eventName}`);
                await updateTimersFromMisty({ seconds, status, eventName });
            }

            return;
        } catch (err) {
            console.error(err);
            return;
        }
    }
}
