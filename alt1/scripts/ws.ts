import { EventRecord } from "./events";
import { addNewEvent, updateEvent, removeEvent } from "./eventHistory";
import { DEBUG, API_URL } from "../config";
import { UUIDTypes, v4 as uuid } from "uuid";
import axios from "axios";
import { decodeJWT, ExpiredTokenRecord } from "./permissions";
import { updateProfileCounters, ProfileRecord, getEventCountData } from "./profile";
import { WorldEventStatus, updateWorld } from "./mistyTimers";
import { WorldRecord } from "./mistyDialog";
import { notifyEvent } from "./notifications";

interface Version {
    version: string;
}
type ReceivedData = EventRecord | ProfileRecord | ExpiredTokenRecord | EventRecord[] | WorldEventStatus | Version;
declare const __APP_VERSION__: string;

// Always read lastReload from sessionStorage when needed

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args: unknown[]) => {
    // Call original console.log
    originalConsoleLog(...args);
    wsClient.log("info", prepareLog(args));
};

console.error = (...args: unknown[]) => {
    // Call original console.log
    originalConsoleError(...args);
    wsClient.log("error", prepareLog(args));
};

console.warn = (...args: unknown[]) => {
    // Call original console.log
    originalConsoleWarn(...args);
    wsClient.log("warn", prepareLog(args));
};

const prepareLog = (args: unknown[]): string => {
    return args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(" ");
};

export async function refreshToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
        console.error("No refresh token found, user needs to re-authenticate.");
        return null;
    }

    try {
        const response = await axios.post(
            `${API_URL}/auth/refresh?token=${refreshToken}`,
            {},
            {
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );

        if (response.data.access_token) {
            console.log("🔄 Token refreshed successfully");
            localStorage.setItem("accessToken", response.data.access_token);
            return response.data.access_token; // ✅ Return new token for immediate use
        } else {
            console.error("⚠️ Failed to refresh token, user must re-authenticate.");
            return null;
        }
    } catch (error) {
        console.error("Error refreshing token:", error);
        return null;
    }
}

export class WebSocketClient {
    private socket: WebSocket | null = null;
    private url: string;
    private sessionID: UUIDTypes;

    constructor(url: string) {
        url = `${url}&discord_id=${this.discordID}`;
        this.url = url;
        this.sessionID = uuid();
    }

    get discordID(): string | null {
        const token = localStorage.getItem("accessToken") ?? "";
        const decoded = token ? decodeJWT(token) : null;
        const discordID = decoded ? decoded.discord_id : null;

        return discordID;
    }

    get rsn(): string | null {
        return sessionStorage.getItem("rsn");
    }

    log(level: "info" | "warn" | "error", message: string): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(
                JSON.stringify({
                    type: "log",
                    sessionID: this.sessionID,
                    level,
                    message,
                    discordID: this.discordID,
                    rsn: this.rsn,
                }),
            );
        }
    }

    connect(): void {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = async () => {
            console.log("✅ Connected to WebSocket!");
            // Send a SYNC message with the last known event timestamp
            const lastEvent = JSON.parse(localStorage.getItem("eventHistory") ?? "[]").slice(-1)[0] as EventRecord;
            const lastEventTimestamp = lastEvent?.timestamp;
            const lastEventId = lastEvent?.id || uuid();
            const lastTimestamp = lastEventTimestamp || 0;
            this.sendSync(lastTimestamp, lastEventId);

            const token = localStorage.getItem("accessToken");
            if (token) {
                const eventCounts = (await getEventCountData()) ?? {};
                updateProfileCounters(eventCounts);
            }
        };

        this.socket.onmessage = async (event) => {
            console.log("📨 Received:", event.data);
            await this.handleMessage(event.data);
        };

        this.socket.onerror = (error) => {
            console.error("❌ WebSocket Error:", error);
        };

        this.socket.onclose = (event) => {
            console.log(`❌ WebSocket Disconnected (code: ${event.code}, reason: ${event.reason})`);
            this.reconnect();
        };
    }

    async handleMessage(data: string): Promise<void> {
        try {
            const parsedData = JSON.parse(data) as ReceivedData;
            // If the sync message returns an array of events, process each one.
            if (Array.isArray(parsedData)) {
                parsedData.forEach((eventObj) => this.processEvent(eventObj));
            } else if ("error" in parsedData) {
                console.error("WebSocket Error: ", parsedData.error);
                if (parsedData.type === "refresh_token") {
                    console.warn("Token expired, requesting a new one...");

                    const newToken = await refreshToken();
                    if (newToken && parsedData.event_data) {
                        console.log("🔄 Resending event after token refresh...");
                        parsedData.event_data.token = newToken; // ✅ Update the token
                        this.send(parsedData.event_data as EventRecord); // ✅ Resend the event
                        console.log("✅ Event sent successfully");
                    }
                }
            } else if ("type" in parsedData && parsedData.type === "clientProfileUpdate") {
                this.processProfileUpdate(parsedData);
            } else if ("type" in parsedData) {
                this.processEvent(parsedData);
            } else if ("version" in parsedData) {
                if (__APP_VERSION__ !== parsedData.version) {
                    const lastReloadTime = sessionStorage.getItem("lastReload");
                    if (!lastReloadTime || Date.now() - Number(lastReloadTime) > 30_000) {
                        sessionStorage.setItem("lastReload", Date.now().toString());
                        window.location.reload();
                    }
                }
            } else {
                await updateWorld(parsedData);
            }
        } catch (error) {
            console.error("⚠️ Failed to parse WebSocket message:", error);
        }
    }

    processProfileUpdate(updateData: ProfileRecord): void {
        updateProfileCounters(updateData.updateFields);
    }

    processEvent(eventData: EventRecord): void {
        console.log("Parsed data: ", eventData);
        if (eventData.type === "addEvent") addNewEvent(eventData);
        if (eventData.type === "editEvent") updateEvent(eventData);
        if (eventData.type === "deleteEvent") removeEvent(eventData);
        notifyEvent(eventData);
    }

    sendSync(lastEventTimestamp: number, lastEventId: UUIDTypes | undefined): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const syncMessage = {
                type: "SYNC",
                lastEventTimestamp,
                lastEventId,
            };
            this.socket.send(JSON.stringify(syncMessage));
        } else {
            console.warn("⚠️ WebSocket is not open. Unable to send SYNC message.");
        }
    }

    send(data: EventRecord | WorldRecord): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.warn("⚠️ WebSocket is not open. Unable to send message.");
        }
    }

    reconnect(): void {
        console.log("🔄 Reconnecting WebSocket in 5 seconds...");
        this.url = this.url.replace(/discord_id=[^&\s]*/, `discord_id=${this.discordID}`);
        setTimeout(() => this.connect(), 5000);
    }
}

export const wsClient = new WebSocketClient(
    DEBUG ? "ws://localhost:8000/ws?room=development" : "wss://ws.dsfeventtracker.com/ws?room=production",
);
wsClient.connect();
