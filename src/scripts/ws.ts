import { EventRecord } from "./events";
import { addNewEvent, updateEvent } from "./eventHistory";
import { DEBUG } from "../config";

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
            const newEvent: EventRecord = JSON.parse(data);
            console.log("Parsed data: ", newEvent);
            if (["addEvent", "testing"].includes(newEvent.type)) {
                addNewEvent(newEvent);
            } else if (newEvent.type === "editEvent") {
                updateEvent(newEvent);
            }
        } catch (error) {
            console.error("⚠️ Failed to parse WebSocket message:", error);
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
