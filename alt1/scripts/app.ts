/**
 * Main entry point for the DSF Event Tracker
 * - Minimal code: sets up Alt1 integration and starts capture
 */

// Import the essential references and assets
import * as a1lib from "alt1";
import "../appconfig.json";
import "../styles/style.css";

// UI and events
import "./ui";

// Our new capture logic
import { initCapture, startCapturing } from "./capture";
import { readTextFromDialogBox } from "./mistyDialog";
import { setDefaultTitleBar, updateTitlebar } from "./notifications";
import { fetchRegistry } from "./worldRegistry";
import { renderMistyTimers } from "./mistyTimers";

// If running in Alt1, identify and start capturing
// The world lists and feature windows come from the server; until this
// resolves the client runs on its bundled fallback. Re-render the Misty tab
// afterwards: it may have painted its locked state before the answer arrived.
void fetchRegistry(() => {
    void renderMistyTimers();
});

if (window.alt1) {
    alt1.identifyAppUrl("./appconfig.json");
    initCapture(); // Set up any needed initial states
    startCapturing(); // Begin capturing every 1s
    updateTitlebar();
} else {
    // Not in Alt1, show instructions
    const addappurl = `alt1://addapp/${new URL("./appconfig.json", document.location.href).href}`;
    document.querySelector("#mainTab h2")!.innerHTML =
        `Alt1 not detected, click <a href='${addappurl}'>here</a> to add this app to Alt1.`;
}

// When the RuneScape client gains focus, start capturing
a1lib.on("rsfocus", () => {
    startCapturing();
    // Optionally restore main content if needed
});

a1lib.on("alt1pressed", async () => {
    if (alt1.rsActive) await readTextFromDialogBox({ alt1Pressed: true });
});

a1lib.on("daemonrun", () => {
    updateTitlebar();
});

window.addEventListener("unload", () => {
    // cleanup to remove any calls and only show stock
    // this is so the status update can have long intervals between runs
    // and still be in sync
    setDefaultTitleBar();
});
