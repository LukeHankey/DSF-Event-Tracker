import { UUIDTypes } from "uuid";

export type EventKeys =
    | "Travelling merchant"
    | "Jellyfish"
    | "Arkaneo"
    | "Sea Monster"
    | "Treasure Turtle"
    | "Whale"
    | "Whirlpool"
    | "Testing";

type EventTimes = {
    [key in EventKeys]: number;
};

export type Events = {
    [key in EventKeys]: string[];
};

type EventRecordTypes = "addEvent" | "editEvent" | "testing";

// Gold text for event arrival is at the start of each value array
// Fisherman text is at the end of events, if any
export const events: Events = {
    "Travelling merchant": [
        "The travelling merchant has arrived at the hub!", // First spawn
        "I wonder what they've got for sale today?",
        "I've seen them sell some really sweet items before.",
        "They don't come around these parts too often, so make sure you check them out!",
    ],
    Jellyfish: [
        "A giant jellyfish has appeared!", // First spawn
        "Jellyfish invasion inbound, get ready!", // Start
        "Another wave of jellyifsh just hopped onto the deck, get rid of them!", // Second round
        "Get them off the deck!", // Randomly
        "Come on, let's kick those jellyfish back into the water!", // Randomly
        "Give 'em a big kick", // Randomly
        "That's one giant jellyfish!", // Randomly
        "They're messing up the deck, get rid of 'em!", // Randomly
    ],
    Arkaneo: [
        "The sailfish, Arkaneo, has appeared!", // First spawn
        "I've heard stories of an angler named Tavia who managed to take a chunk out of him once.",
        "Look at how fast he is!",
        "It's Arkaneo!",
        "I've never seen something move so fast in my life!",
        "No one has ever been able to catch this one.",
    ],
    "Sea Monster": [
        "A sea monster has appeared!", // First spawn
        "Ahh! The sea monster is back, get some rotten food from those barrels!", // Rotten fish
        "Oh no, it's hungry! Start throwing any raw food you've got at it", // Raw fish
        "Come on, throw him some fish!", // Randomly
        "Give him some fish!", // Randomly
        "He looks pretty hungry!", // Randomly
        "That one has some really sharp teeth!", // Randomly
        "That's one nasty looking sea monster!", // Randomly
        "The poor thing needs some food!", // Randomly
        "Throw him some fish!", // Randomly
    ],
    "Treasure Turtle": [
        "A treasure turtle has appeared at the hub!", // First spawn
        "Check him out, don't miss your chance!",
        "I bet that chest is full of treasure.",
        "Lovely, lovely treasure...",
        "That's one pretty turtle!",
        "These treasure turtles are awfully rare I'll have you know.",
    ],
    Whale: [
        "A whale has appeared at the hub!", // First spawn
        "Captain, there be whales here!",
        "Don't fall in. You wouldn't want to get swallowed by that one!",
        "His mouth is full of fish, cast your lines!",
        "That's one giant whale!",
        // Fisherman
        "Get him to spit me out!",
        "Ughhhhh! HELP!",
        "Ugh! Give me a hand, he's swallowed me whole!",
        "AHHHHHHHHHH! It's REALLY wet in here!",
    ],
    Whirlpool: [
        "A whirlpool has appeared at the hub!", // First spawn
        "Don't fall in. You don't want to get sucked in by that!",
        "If you throw coins in and the whirlpool glows, that's when you know we're in for a treat!",
        "Sometimes we're rewarded for being generous, when throwing coins into the water.",
        "That's one big whirlpool!",
        "I nearly fell in before, that was scary...",
    ],
    Testing: ["1", "Test", "Testing @@@@@ 123456789 abcdefghijklmnopqrstuvwxyz 123"],
};

export const eventExpiredText: Events = {
    "Travelling merchant": ["The travelling merchant has departed..."],
    Jellyfish: ["The giant jellyfish has departed..."],
    Arkaneo: ["The sailfish, Arkaneo, has departed..."],
    "Sea Monster": ["The sea monster has departed..."],
    "Treasure Turtle": ["The treasure turtle has departed..."],
    Whale: ["The whale has departed..."],
    Whirlpool: ["The whirlpool has disappeared..."],
    Testing: ["test"],
};

export const firstEventTexts = Object.values(events).map((texts) => texts[0]);

const ONE_MINUTE = 60;

// In seconds
export const eventTimes: EventTimes = {
    "Travelling merchant": ONE_MINUTE * 10,
    Arkaneo: 39,
    Jellyfish: ONE_MINUTE * 2,
    Whale: ONE_MINUTE * 2,
    "Sea Monster": ONE_MINUTE * 2,
    Whirlpool: ONE_MINUTE * 5,
    "Treasure Turtle": ONE_MINUTE * 5,
    Testing: 30,
};

export interface EventRecord {
    id: UUIDTypes;
    type: EventRecordTypes;
    event: EventKeys;
    world: string;
    duration: number; // in seconds, or you can use a string if you prefer
    reportedBy: string;
    timestamp: number; // ISO string or any format you like
    oldEvent: EventRecord | null;
    token: string | null;
}
