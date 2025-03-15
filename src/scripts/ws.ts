import { EventRecord } from "./events";
import { addNewEvent, updateEvent } from "./eventHistory";
import { DEBUG, ORIGIN } from "../config";
import { UUIDTypes, v4 as uuid } from "uuid";
import axios from "axios";
import { decodeJWT } from "./permissions";

async function refreshToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
        console.error("No refresh token found, user needs to re-authenticate.");
        return null;
    }

    try {
        const response = await axios.post(
            "https://api.dsfeventtracker.com/auth/refresh/",
            {
                headers: {
                    "Content-Type": "application/json",
                    Origin: ORIGIN,
                },
                refresh_token: refreshToken,
            },
        );

        if (response.data.access_token) {
            console.log("🔄 Token refreshed successfully");
            localStorage.setItem("accessToken", response.data.access_token);
            return response.data.access_token; // ✅ Return new token for immediate use
        } else {
            console.error(
                "⚠️ Failed to refresh token, user must re-authenticate.",
            );
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

    constructor(url: string) {
        this.url = url;
    }

    connect(): void {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log("✅ Connected to WebSocket!");
            // Send a SYNC message with the last known event timestamp
            const lastEvent = JSON.parse(
                localStorage.getItem("eventHistory") ?? "[]",
            ).slice(-1)[0] as EventRecord;
            const lastEventTimestamp = lastEvent?.timestamp;
            const lastEventId = lastEvent?.id || uuid();
            const lastTimestamp = lastEventTimestamp || 0;
            this.sendSync(lastTimestamp, lastEventId);
        };

        this.socket.onmessage = async (event) => {
            console.log("📨 Received:", event.data);
            await this.handleMessage(event.data);
        };

        this.socket.onerror = (error) => {
            console.error("❌ WebSocket Error:", error);
        };

        this.socket.onclose = (event) => {
            console.log(
                `❌ WebSocket Disconnected (code: ${event.code}, reason: ${event.reason})`,
            );
            this.reconnect();
        };
    }

    async handleMessage(data: string): Promise<void> {
        try {
            const parsedData = JSON.parse(data);
            // If the sync message returns an array of events, process each one.
            if (Array.isArray(parsedData)) {
                parsedData.forEach((eventObj) => this.processEvent(eventObj));
            } else if (parsedData.error) {
                console.error("WebSocket Error: ", parsedData.error);
                if (parsedData.action === "refresh_token") {
                    console.warn("Token expired, requesting a new one...");

                    const newToken = await refreshToken();
                    if (newToken && parsedData.event_data) {
                        console.log(
                            "🔄 Resending event after token refresh...",
                        );
                        parsedData.event_data.token = newToken; // ✅ Update the token
                        this.send(parsedData.event_data as EventRecord); // ✅ Resend the event
                    }
                }
            } else {
                this.processEvent(parsedData);
            }
        } catch (error) {
            console.error("⚠️ Failed to parse WebSocket message:", error);
        }
    }

    processEvent(eventData: EventRecord): void {
        console.log("Parsed data: ", eventData);
        if (["addEvent", "testing"].includes(eventData.type)) {
            addNewEvent(eventData);
        } else if (eventData.type === "editEvent") {
            updateEvent(eventData);
        }
    }

    sendSync(
        lastEventTimestamp: number,
        lastEventId: UUIDTypes | undefined,
    ): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const syncMessage = {
                type: "SYNC",
                lastEventTimestamp,
                lastEventId,
            };
            this.socket.send(JSON.stringify(syncMessage));
        } else {
            console.warn(
                "⚠️ WebSocket is not open. Unable to send SYNC message.",
            );
        }
    }

    send(data: EventRecord): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.warn("⚠️ WebSocket is not open. Unable to send message.");
        }
    }

    reconnect(): void {
        console.log("🔄 Reconnecting WebSocket in 5 seconds...");
        setTimeout(() => this.connect(), 5000);
    }
}

const token = localStorage.getItem("accessToken") ?? "";
const decoded = token ? decodeJWT(token) : null;
const discordID = decoded ? decoded.discord_id : null;

export const wsClient = new WebSocketClient(
    DEBUG
        ? `wss://ws.dsfeventtracker.com/ws?room=development&discord_id=${discordID}`
        : `wss://ws.dsfeventtracker.com/ws?room=production&discord_id=${discordID}`,
);
wsClient.connect();
