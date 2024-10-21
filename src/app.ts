// alt1 base libs, provides all the commonly used methods for image matching and capture
import * as a1lib from "alt1";
import ChatBoxReader from "@alt1/chatbox";
import axios from "axios";

// Import necessary files
import "./index.html";
import "./appconfig.json";
import "./icon.png";
import "./settingsbutton.png"
import { Events, events } from "./events"


const chatbox = new ChatBoxReader();
chatbox.readargs.colors.push(
    a1lib.mixColor(...[239, 0, 0]),  // red text
    a1lib.mixColor(...[255, 100, 0]),  // dark orange text
    a1lib.mixColor(...[255, 136, 0]),  // dsf merch text
    a1lib.mixColor(...[0, 166, 82]),  // misty text
);

// Define a variable to hold the interval ID
let captureInterval;

interface Events {
    [name: string]: string[]
}

const events: Events = {
    "Travelling merchant": [
        "I wonder what they've got for sale today?",
        "I've seen them sell some really sweet items before.",
        "They don't come around these parts too often, so make sure you check them out!"
    ],
    "Jellyfish": [
        "Jellyfish invasion inbound, get ready!", // Start
        "Another wave of jellyifsh just hopped onto the deck, get rid of them!", // Second round
        "Get them off the deck!", // Randomly
        "Come on, let's kick those jellyfish back into the water!", // Randomly
        "Give 'em a big kick", // Randomly
        "That's one giant jellyfish!", // Randomly
        "They're messing up the deck, get rid of 'em!", // Randomly
    ],
    "Arkaneo": [
        "I've heard stories of an angler named Tavia who managed to take a chunk out of him once.",
        "Look at how fast he is!",
    ],
    "Sea Monster": [
        "Ahh! The sea monster is back, get some rotten food from those barrels!", // Rotten fish
        "Oh no, it's hungry! Start throwing any raw food you've got at it",  // Raw fish
        "Come on, throw him some fish!",  // Randomly
        "Give him some fish!",  // Randomly
        "He looks pretty hungry!",  // Randomly
        "That one has some really sharp teeth!",  // Randomly
        "That's one nasty looking sea monster!",  // Randomly
        "The poor thing needs some food!",  // Randomly
        "Throw him some fish!",  // Randomly
    ],
    "Treasure Turtle": [
        "Check him out, don't miss your chance!",
        "I bet that chest is full of treasure.",
        "Lovely, lovely treasure...",
        "That's one pretty turtle!",
        "These treasure turtles are awfully rare I'll have you know.",
    ],
    "Whale": [
        "Captain, there be whales here!",
        "Don't fall in. You wouldn't want to get swallowed by that one!",
        "His mouth is full of fish, cast your lines!",
        "That's one giant whale!",
    ],
    "Whirlpool": [
        "Don't fall in. You don't want to get sucked in by that!",
        "If you throw coins in and the whirlpool glows, that's when you know we're in for a treat!",
        "Sometimes we're rewarded for being generous, when throwing couns into the water.",
        "That's one big whirlpool!",
        "I nearly fell in before, that was scary..."
    ],
    "Testing": ["Guys: 1", "Guys: Test"],
}

// Capture function to get the screen image
export function capture() {
    if (!window.alt1) {
        output.insertAdjacentHTML("beforeend", `<div>You need to run this page in alt1 to capture the screen</div>`);
        return;
    }
    if (!alt1.permissionPixel || !alt1.permissionGameState || !alt1.permissionOverlay) {
        output.insertAdjacentHTML("beforeend", `<div>Page is not installed as an app or capture permission is not enabled</div>`);
        return;
    }
    var img = a1lib.captureHoldFullRs();
    readChatFromImage(img);
}

// Function to read chat messages from the image and display colored text
async function readChatFromImage(img) {
    var chatData = chatbox.find(img); // Find chat boxes in the image
    if (!chatData) {
        output.insertAdjacentHTML("beforeend", `<div>Could not find chat boxes</div>`);
        return;
    }

    var lines = chatbox.read(); // Read lines from the detected chat box
    if (lines?.length) {
        for (const line of lines) {
            console.log(line)

            // Process each fragment and apply its color
            const coloredText = line.fragments.map(fragment => {
                // Convert RGB array to CSS hex color code
                const color = rgbToHex(fragment.color);
                // Return the fragment text wrapped in a span with the corresponding color
                return `<span style="color: ${color};">${fragment.text}</span>`;
            }).join(""); // Join all fragments into a single string


            // If any keyword was found in any fragment, collect all fragment texts
            const allTextFromLine = line.fragments.map(fragment => fragment.text).join(""); // Join all fragment texts

            // Check if the text contains any keywords from the 'events' object
            const matchingEvent = getMatchingEvent(allTextFromLine, events);

            if (matchingEvent) {
                // Send the combined text to the server
                try {
                    await axios.post("http://127.0.0.1:5000/send_webhook", {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        event: matchingEvent,
                        world: alt1.currentWorld
                    });
                } catch (err) {
                    console.log(1, err)
                }
            }

            // Insert the line into the output
            output.insertAdjacentHTML(
                "beforeend",
                `<div>${coloredText}</div>`
            );
        }
    } else {
        // output.insertAdjacentHTML("beforeend", `<div>No new chat lines detected</div>`);
    }
}

// Helper function to check if the line contains a keyword from the events object
function getMatchingEvent(lineText: string, events: Events): string | null {
    // Define the regex pattern to match the line format
    const regex = /^(?:\[\d{2}:\d{2}:\d{2}\]\s*)?Misty: .+$/;

    // Check if the lineText matches the regex
    if (!regex.test(lineText) && !events["Testing"].some(phrase => lineText.includes(phrase))) {
        return null; // Return null if the format does not match
    }

    // Loop through the events object
    for (const [eventKey, phrases] of Object.entries(events)) {
        for (const phrase of phrases) {
            // Check if the lineText includes any of the phrases
            if (lineText.includes(phrase)) {
                return eventKey; // Return the event key if a phrase matches
            }
        }
    }
    
    return null; // Return null if no match is found
}



// Function to convert RGB array to a hex color code
function rgbToHex([r, g, b]) {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Function to start capturing
function startCapturing() {
    if (captureInterval) return; // Prevent starting multiple intervals
    captureInterval = setInterval(capture, 1000); // Start capturing every 1 second
    output.insertAdjacentHTML("beforeend", `<div>Auto-capturing started.</div>`);
}

// Function to stop capturing
function stopCapturing() {
    clearInterval(captureInterval);
    captureInterval = null; // Clear the interval ID
    output.insertAdjacentHTML("beforeend", `<div>Auto-capturing stopped.</div>`);
}

document.body.style.backgroundImage = "url('./background.png')";

// Check if we are running inside alt1
if (window.alt1) {
    alt1.identifyAppUrl("./appconfig.json");
    startCapturing(); // Start capturing when Alt1 is identified
} else {
    let addappurl = `alt1://addapp/${new URL("./appconfig.json", document.location.href).href}`;
    output.insertAdjacentHTML("beforeend", `Alt1 not detected, click <a href='${addappurl}'>here</a> to add this app to Alt1`);
}

// Handle RuneScape game window focus and blur events using Alt1 API
a1lib.on("rsfocus", () => {
    startCapturing(); // Start capturing when the RuneScape game window is focused
    output.insertAdjacentHTML("beforeend", `<div>RuneScape window focused. Auto-capturing resumed.</div>`);
});

a1lib.on("rsblur", () => {
    stopCapturing(); // Stop capturing when the RuneScape game window loses focus
    output.insertAdjacentHTML("beforeend", `<div>RuneScape window lost focus. Auto-capturing paused.</div>`);
});

// UI for displaying auto-capture status
output.insertAdjacentHTML("beforeend", `
    <div>Capturing chat automatically every 5 seconds when RuneScape is in focus.</div>
`);

