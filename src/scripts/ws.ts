import { io, Socket } from "socket.io-client";
import { EventRecord } from "./events";
import { addNewEvent } from "./capture";
import { DEBUG, WS } from "../config";

let socket: Socket | null = null;
if (DEBUG && WS) {
    // Initialize the socket connection
    socket = io("https://localhost:5000", {
        transports: ["websocket"],
    });

    // Handle connection events
    socket.on("connect", () => {
        console.log("Connected, id:", socket.id);
    });

    // Handle our custom "event_data" event
    socket.on("updateEventHistory", (data: EventRecord) => {
        console.log("Received event_data:", data);
        addNewEvent(data);
    });
}

// Export the socket so it can be used elsewhere (for example, to emit events)
export default socket;
