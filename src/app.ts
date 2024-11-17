// alt1 base libs, provides all the commonly used methods for image matching and capture
import * as a1lib from "alt1";
import ChatBoxReader from "alt1/chatbox";
import * as OCR from "alt1/ocr";
import axios from "axios";
import { webpackImages } from "alt1/base";
import font from "alt1/fonts/aa_8px_mono.js";

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
    a1lib.mixColor(...[50, 120, 190])  // fisherman
);

const imgs = webpackImages({
    runescapeWorldPretext: require("./runescape_world_pretext.data.png")
})

// Define a variable to hold the interval ID
let captureInterval: NodeJS.Timeout;
let previousMainContent: string;
let hasTimestamps: boolean;
let lastTimestamp: Date;
let lastMessage: string;
let ORIGIN = document.location.href;
let worldHopMessage: boolean = false;

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

const findWorldNumber = async (img: a1lib.ImgRefBind): Promise<string | undefined> => {
    const imageRef = imgs.runescapeWorldPretext
    const pos = img.findSubimage(imageRef)
    const buffData: ImageData = img.toData();
    
    let worldNumber;
    if(pos.length) {
        for (let match of pos) {
            const textObj = OCR.findReadLine(buffData, font, [[255, 155, 0]], match.x + 5, match.y + 2)
            worldNumber = textObj.text.match(/\d{1,3}/)[0]
        }
    }
    
    return worldNumber
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

    let lines = chatbox.read(); // Read lines from the detected chat box
    if ((lines.length > 1 && lines.some(line => line.text.includes("Attempting to switch worlds..."))) || worldHopMessage) {
        let worldNumber = await findWorldNumber(img)
        if (!worldNumber) {
            console.log("Unable to capture world number from Friends List. Make sure the interface is viewable on screen.")
        } else {
            // Save the previous world just in case
            const previousWorld = sessionStorage.getItem("currentWorld")
            if (previousWorld !== worldNumber) {
                sessionStorage.setItem("previousWorld", previousWorld)
                sessionStorage.setItem("currentWorld", worldNumber)
            }
        }
        worldHopMessage = false
     }
    if (!hasTimestamps) lines.some(line => line.fragments.length > 1 && /\d\d:\d\d:\d\d/.test(line.fragments[1].text)) ? hasTimestamps = true : hasTimestamps = false

    let combinedText = ""
    let recentTimestamp: null | string = null;
    lastTimestamp = new Date(sessionStorage.getItem("lastTimestamp"))
    lastMessage = sessionStorage.getItem("lastMessage")
    if (lines?.length) {
        // Remove blank lines
        if (lines.some(line => line.text === "")) lines = lines.filter(line => line.text !== "")

        lines.some(line => line.text.includes("Attempting to switch worlds...")) ? worldHopMessage = true : worldHopMessage = false
        
        // Remove all messages which are not older than the lastTimestamp
        // Messages will not be sent if there are messages which are sent at the same time!
        if (lastTimestamp) lines = lines.filter(line => new Date(`${new Date().toLocaleDateString()} ` + line.fragments[1]?.text) >= lastTimestamp)

        for (const line of lines) {
            if (line.text === lastMessage) continue
            lastMessage = line.text
            sessionStorage.setItem("lastMessage", lastMessage)
            console.log(line)
            
            const allTextFromLine = line.text
            combinedText = combinedText === "" ? combinedText += allTextFromLine : combinedText + " " + allTextFromLine
            
            if (hasTimestamps && line.fragments.length > 1) recentTimestamp = line.fragments[1].text
            lastTimestamp = new Date(`${new Date().toLocaleDateString()} ` + recentTimestamp) ?? new Date()
            sessionStorage.setItem("lastTimestamp", String(lastTimestamp))
            
            // Check if the text contains any keywords from the 'events' object
            const [partialMatch, matchingEvent] = getMatchingEvent(combinedText, events);

            if (matchingEvent && !partialMatch) {
                const time = line.fragments[1]?.text ?? recentTimestamp

                // Send the combined text to the server
                const current_world = worldHopMessage
                    ? sessionStorage.getItem("previousWorld")
                    : alt1.currentWorld < 0
                        ? sessionStorage.getItem("currentWorld")
                        : alt1.currentWorld

                try {
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
                    console.log(`Duplicate event - ignoring ${matchingEvent} on ${current_world}`)
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
