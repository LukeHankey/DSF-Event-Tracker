/**
 * Main entry point for the DSF Event Tracker
 * - Minimal code: sets up Alt1 integration and starts capture
 */

// Import the essential references and assets
import * as a1lib from "alt1";
import "../appconfig.json";
import "../styles/style.css";
import "../index.html";

// UI and events
import "./ui";

// Our new capture logic
import { initCapture, startCapturing } from "./capture";

// If running in Alt1, identify and start capturing
if (window.alt1) {
    alt1.identifyAppUrl("./appconfig.json");
    initCapture(); // Set up any needed initial states
    startCapturing(); // Begin capturing every 1s
} else {
    // Not in Alt1, show instructions
    const addappurl = `alt1://addapp/${new URL("./appconfig.json", document.location.href).href}`;
    document.querySelector("#mainTab p")!.innerHTML =
        `Alt1 not detected, click <a href='${addappurl}'>here</a> to add this app to Alt1.`;
}

// When the RuneScape client gains focus, start capturing
a1lib.on("rsfocus", () => {
    startCapturing();
    // Optionally restore main content if needed
});
