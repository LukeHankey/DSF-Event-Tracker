export interface Events {
    [name: string]: string[]
}

export const events: Events = {
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