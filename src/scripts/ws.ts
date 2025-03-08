import { EventRecord } from "./events";
import { addNewEvent, updateEvent } from "./eventHistory";
import { DEBUG } from "../config";
import { UUIDTypes } from "uuid";

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
                localStorage.getItem("eventHistory"),
            ).slice(-1)[0] as EventRecord;
            const lastEventTimestamp = lastEvent?.timestamp;
            const lastEventId = lastEvent?.id;
            const lastTimestamp = lastEventTimestamp || 0;
            this.sendSync(lastTimestamp, lastEventId);
        };

        this.socket.onmessage = (event) => {
            console.log("📨 Received:", event.data);
            this.handleMessage(event.data);
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

    handleMessage(data: string): void {
        try {
            const parsedData = JSON.parse(data);
            // If the sync message returns an array of events, process each one.
            if (Array.isArray(parsedData)) {
                parsedData.forEach((eventObj) => this.processEvent(eventObj));
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

    sendSync(lastEventTimestamp: number, lastEventId: UUIDTypes): void {
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

export const wsClient = new WebSocketClient(
    DEBUG
        ? "wss://ws.dsfeventtracker.com/ws?room=development"
        : "wss://ws.dsfeventtracker.com/ws",
);
wsClient.connect();
