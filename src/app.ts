// alt1 base libs, provides all the commonly used methods for image matching and capture
import * as a1lib from "alt1";
import ChatBoxReader from "alt1/chatbox";
import axios from "axios";

// Import necessary files
import "./index.html";
import "./appconfig.json";
import "./icon.png";
import { Events, EventKeys, events, eventTimes } from "./events"


const chatbox = new ChatBoxReader();
chatbox.readargs.colors.push(
    a1lib.mixColor(...[239, 0, 0]),  // red text
    a1lib.mixColor(...[255, 100, 0]),  // dark orange text
    a1lib.mixColor(...[255, 136, 0]),  // dsf merch text
    a1lib.mixColor(...[0, 166, 82]),  // misty text
);

// Define a variable to hold the interval ID
let captureInterval: NodeJS.Timeout;
let previousMainContent: string;
let hasTimestamps: boolean;
let ORIGIN = document.location.href

// DONT FORGET TO CHANGE THIS BACK TO FALSE FOR PRODUCTION \\
const DEBUG = false

if (DEBUG) {
    ORIGIN = "https://lukehankey.github.io/DSF-Event-Tracker/"
}

// Capture function to get the screen image
export function capture() {
    if (!window.alt1) {
        document.querySelector('#mainTab p').textContent = "You need to run this page in alt1 to capture the screen."
        return;
    }
    if (!alt1.permissionPixel || !alt1.permissionGameState || !alt1.permissionOverlay) {
        document.querySelector('#mainTab p').textContent = "Page is not installed as an app or permissions are not correct."
        return;
    }
    try {
        var img = a1lib.captureHoldFullRs();
        readChatFromImage(img);
    } catch (err) {
        console.log("Failed to capture screen")
    }
}


// Function to read chat messages from the image and display colored text
async function readChatFromImage(img: a1lib.ImgRefBind): Promise<void> {
    const chatData = chatbox.find(img); // Find chat boxes in the image
    if (!chatData) {
        document.querySelector('#mainTab p').textContent = "Could not find chat box."
        return;
    }

    if (document.querySelector('#mainTab p').textContent === "Could not find chat box.") {
        document.querySelector('#mainTab p').innerHTML = previousMainContent
    }

    const lines = chatbox.read(); // Read lines from the detected chat box
    if (!hasTimestamps) lines.some(line => line.fragments.length > 1 && /\d\d:\d\d:\d\d/.test(line.fragments[1].text)) ? hasTimestamps = true : hasTimestamps = false

    let combinedText = ""
    let recentTimestamp: null | string = null;
    if (lines?.length) {
        for (const line of lines) {
            console.log(line)
            
            const allTextFromLine = line.text
            combinedText = combinedText === "" ? combinedText += allTextFromLine : combinedText + " " + allTextFromLine

            if (hasTimestamps && line.fragments.length > 1) recentTimestamp = line.fragments[1].text

            // Check if the text contains any keywords from the 'events' object
            const [partialMatch, matchingEvent] = getMatchingEvent(combinedText, events);

            if (matchingEvent && !partialMatch) {
                const time = line.fragments[1]?.text ?? recentTimestamp

                // Send the combined text to the server
                try {
                    const current_world = alt1.currentWorld
                    const response = await axios.post(
                        "https://i3fhqxgish.execute-api.eu-west-2.amazonaws.com/send_webhook", {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                "Origin": ORIGIN,
                            },
                            event: matchingEvent,
                            world: current_world,
                            debug: DEBUG,
                        }
                    );

                    const mainTabPs = document.getElementById("mainTab").getElementsByTagName("p");
                    const content = `A ${matchingEvent} spawned on world ${current_world} at ${time}.`

                    // Main element, event element, suggestion/report element
                    if (mainTabPs.length === 3) {
                        const eventP = mainTabPs[1]
                        eventP.textContent = content
                    } else {
                        const eventP = document.createElement("p");
                        eventP.textContent = content
                        document.querySelector('#mainTab p').after(eventP)
                    }
                    
                    // Send timer request to avoid duplicate calls
                    if (response.status === 201) {
                        const eventTime = eventTimes[matchingEvent]
                        const response = await axios.post(
                            "https://i3fhqxgish.execute-api.eu-west-2.amazonaws.com/clear_event_timer", {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    "Origin": ORIGIN,
                                },
                                event: matchingEvent,
                                world: current_world,
                                timeout: eventTime
                            }
                        )

                        if (response.status != 200) {
                            console.log(`There was no ${matchingEvent}_${current_world} in the server cache.`)
                        }
                    }
                } catch (err) {
                    console.log("Duplicate event - ignoring.")
                }
            } else if (!partialMatch) {
                combinedText = ""
            }
        }
    }
}

// Helper function to check if the line contains a keyword from the events object
function getMatchingEvent(lineText: string, events: Events): [boolean, EventKeys | null] {
    // Define the regex pattern to match the line format
    const regex = /^(?:\[\d{2}:\d{2}:\d{2}\]\s*)?Misty: .+$/;
    const timeRegex = /\[\d{2}:\d{2}:\d{2}\]/;

    // Chop '[hh:mm:ss] '
    if (timeRegex.test(lineText)) lineText = lineText.slice(11)

    // Check if the lineText matches the regex or is a testing event
    if (!regex.test(lineText) && !events["Testing"].some(phrase => phrase.includes(lineText))) {
        return [false, null]; // Return null if the format does not match
    }

    // Chop 'Misty: '
    if (lineText.startsWith("Misty: ")) lineText = lineText.slice(7)

    // Loop through the events object
    for (const [eventKey, phrases] of Object.entries(events)) {
        for (const phrase of phrases) {
            // Check if the lineText equals any of the phrases
            if (lineText === phrase) {
                return [false, eventKey as EventKeys]; // Return the event key if a phrase matches
            }

            if (phrase.includes(lineText)) {
                return [true, eventKey as EventKeys];
            }
        }
    }
    
    return [false, null]; // Return null if no match is found
}

// Function to start capturing
function startCapturing(): void {
    if (captureInterval) return; // Prevent starting multiple intervals
    captureInterval = setInterval(capture, 1000); // Start capturing every 1 second
}

// Function to stop capturing
function stopCapturing(): void {
    clearInterval(captureInterval);
    captureInterval = null; // Clear the interval ID
}

// Check if we are running inside alt1
if (window.alt1) {
    alt1.identifyAppUrl("./appconfig.json");
    previousMainContent = document.querySelector('#mainTab p').innerHTML;
    startCapturing(); // Start capturing when Alt1 is identified
} else {
    let addappurl = `alt1://addapp/${new URL("./appconfig.json", document.location.href).href}`;
    document.querySelector('#mainTab p').innerHTML = `Alt1 not detected, click <a href='${addappurl}'>here</a> to add this app to Alt1.`;
}

// Handle RuneScape game window focus and blur events using Alt1 API
a1lib.on("rsfocus", () => {
    startCapturing(); // Start capturing when the RuneScape game window is focused
    document.querySelector('#mainTab p').innerHTML = previousMainContent;
});
