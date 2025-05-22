type Slot = "A" | "B" | "C" | "D";

const slotMap: Record<Slot, string[]> = {
    A: ["Uncharted island map"],
    B: [
        "Gift for the Reaper",
        "Broken fishing rod",
        "Barrel of bait",
        "Anima crystal",
        "Small goebie burial charm",
        "Medium goebie burial charm",
        "Menaphite gift offering (small)",
        "Menaphite gift offering (medium)",
        "Shattered anima",
        "D&D token (daily)",
        "Sacred clay",
        "Livid plant",
        "Slayer VIP Coupon",
        "Silverhawk Down",
        "Unstable air rune",
        "Advanced pulse core",
        "Tangled fishbowl",
        "Unfocused damage enhancer",
        "Horn of honour",
    ],
    C: [], // Will be set to slotMap.B below
    D: [
        "Taijitu",
        "Large goebie burial charm",
        "Menaphite gift offering (large)",
        "D&D token (weekly)",
        "D&D token (monthly)",
        "Dungeoneering Wildcard",
        "Message in a bottle",
        "Crystal triskelion",
        "Starved ancient effigy",
        "Deathtouched dart",
        "Dragonkin lamp",
        "Harmonic dust",
        "Unfocused reward enhancer",
    ],
};

// A dummy mapping from item name to cost string
const itemCosts: Record<string, string> = {
    "Uncharted island map": "800K coins",
    "Gift for the Reaper": "1,25M coins",
    "Broken fishing rod": "50K coins",
    "Barrel of bait": "50K coins",
    "Anima crystal": "150K coins",
    "Small goebie burial charm": "50K coins",
    "Medium goebie burial charm": "100K coins",
    "Menaphite gift offering (small)": "100K coins",
    "Menaphite gift offering (medium)": "300K coins",
    "Shattered anima": "150K coins",
    "D&D token (daily)": "250K coins",
    "Sacred clay": "600K coins",
    "Livid plant": "1M coins",
    "Slayer VIP Coupon": "200K coins",
    "Silverhawk Down": "1.5M coins",
    "Unstable air rune": "250K coins",
    "Advanced pulse core": "800K coins",
    "Tangled fishbowl": "50K coins",
    "Unfocused reward enhancer": "10M coins",
    "Horn of honour": "1M coins",
    Taijitu: "800K coins",
    "Large goebie burial charm": "150K coins",
    "Menaphite gift offering (large)": "500K coins",
    "D&D token (weekly)": "400K coins",
    "D&D token (monthly)": "1M coins",
    "Dungeoneering Wildcard": "400K coins",
    "Message in a bottle": "200K coins",
    "Crystal triskelion": "2M coins",
    "Starved ancient effigy": "1M coins",
    "Deathtouched dart": "5M coins",
    "Dragonkin lamp": "250K coins",
    "Harmonic dust": "1M coins",
};

// Set slot C to be identical to slot B.
slotMap.C = slotMap.B;

// Define slot constants for slots B, C, and D.
const slotConstants: Record<Exclude<Slot, "A">, [number, number]> = {
    B: [3, 19],
    C: [8, 19],
    D: [5, 13],
};

const req = require.context("../assets/stock_icons", false, /\.png$/);
const icons = req.keys().reduce(
    (acc, path) => {
        const key = path.replace("./", "").replace(".png", "");
        acc[key] = req(path);
        return acc;
    },
    {} as Record<string, string>,
);

const getRuneDate = () => {
    const initialRuneDate = Date.UTC(2002, 1, 27); // Base date
    const now = new Date();
    return Math.floor((now.getTime() - initialRuneDate) / (1000 * 3600 * 24));
};

const getSlot = (slot: Exclude<Slot, "A">, runedate: number): string => {
    const [constant, numUnique] = slotConstants[slot];
    const runedateBigInt = BigInt(runedate);

    let seed = (runedateBigInt << BigInt(32)) + (runedateBigInt % BigInt(constant));
    const multiplier = BigInt("0x5DEECE66D");
    const mask = BigInt(2 ** 48 - 1);
    const addend = BigInt(11);

    seed = (seed ^ multiplier) & mask;
    seed = (seed * multiplier + addend) & mask;

    const slotIndex = Number((seed >> BigInt(17)) % BigInt(numUnique));
    return slotMap[slot][slotIndex];
};

const getAllSlots = (runedate: number): { A: string; B: string; C: string; D: string } => {
    const stock: Partial<{ A: string; B: string; C: string; D: string }> = {};

    stock.A = slotMap.A[0];
    stock.B = getSlot("B", runedate);
    stock.C = getSlot("C", runedate);
    stock.D = getSlot("D", runedate);

    return stock as { A: string; B: string; C: string; D: string };
};

function getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

function formatDateWithOrdinal(date: Date): string {
    const day = date.getDate();
    const ordinal = getOrdinal(day);
    const month = date.toLocaleString("default", { month: "long" });
    const year = date.getFullYear();
    return `${day}${ordinal} ${month} ${year}`;
}

function getImagePath(item: string): string {
    const key = item.toLowerCase().replace(/&/g, "and").replace(/\s+/g, "_").replace(/[()]/g, "").replace(/_+/g, "_");
    return icons[key] || ""; // fallback if not found
}

export function renderStockTable(): void {
    // Get the table body element from the mainTab stock table
    const tableBody = document.querySelector<HTMLTableSectionElement>("#stock-table table.event-table tbody");
    if (!tableBody) return;

    // Clear any existing rows
    tableBody.innerHTML = "";

    // Get today's rune date (number of days since 27 Feb 2002)
    const todayRuneDate = getRuneDate();
    Number(Math.random() * 10);

    // Loop through today and the next 6 days
    for (let i = 0; i < 7; i++) {
        // Calculate the rune date for this day
        const currentRuneDate = todayRuneDate + i;

        // Get stock for the day; include slot A (map) if you want that column
        const stock = getAllSlots(currentRuneDate);

        // Create a new table row
        const row = document.createElement("tr");

        // Create the Date cell. For today, display "Today", otherwise format the date.
        const dateCell = document.createElement("td");
        const now = new Date();
        // Create a UTC date with today's UTC year, month, and UTC date plus i days.
        const currentDateUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
        dateCell.textContent = i === 0 ? "Today" : formatDateWithOrdinal(currentDateUTC);
        row.appendChild(dateCell);

        // For each slot (A, B, C, D), create a cell with the image.
        // Slot A (map) is an array, so we use the first element.
        const slots: Slot[] = ["A", "B", "C", "D"];
        for (const slot of slots) {
            const cell = document.createElement("td");
            const item = stock[slot];
            if (item) {
                const img = document.createElement("img");
                img.src = getImagePath(item);
                img.alt = item;
                img.title = item;
                // Optionally, set dimensions or styles
                img.style.width = slot === "A" ? "25px" : "20px";
                img.style.height = "25px";
                cell.appendChild(img);
            }
            row.appendChild(cell);
        }

        // Append the row to the table body
        tableBody.appendChild(row);
    }
}

function showDetailedStockForDate(selectedDate: Date): void {
    // Update the modal header with the formatted date
    const merchantDateHeading = document.getElementById("merchantDateHeading") as HTMLElement;
    if (merchantDateHeading) {
        merchantDateHeading.textContent = formatDateWithOrdinal(selectedDate);
    }

    // Calculate the runedate for the selected date.
    const initialRuneDate = Date.parse("27 Feb 2002");
    const selectedRunedate = Math.floor((selectedDate.getTime() - initialRuneDate) / (1000 * 3600 * 24));

    // Get the stock for that day.
    const stock = getAllSlots(selectedRunedate);

    // Get the modal container for the detailed stock.
    const merchantCardsContainer = document.getElementById("merchantCardsContainer");
    if (!merchantCardsContainer) return;

    // Clear any previous content.
    merchantCardsContainer.innerHTML = "";

    // We'll show a card for each slot: A, B, C, and D.
    const slots: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
    slots.forEach((slot) => {
        const item = stock[slot];
        if (!item) return;

        // Create a card container.
        const card = document.createElement("div");
        card.classList.add("merchant-card");

        // Item full name above the image.
        const title = document.createElement("h4");
        title.textContent = item;
        card.appendChild(title);

        // Create a container for the image and cost side by side.
        const infoRow = document.createElement("div");
        infoRow.classList.add("merchant-item-info");

        // Create the item image.
        const img = document.createElement("img");
        img.src = getImagePath(item);
        img.alt = item;
        infoRow.appendChild(img);

        // Create the cost element.
        const costDiv = document.createElement("div");
        costDiv.classList.add("merchant-cost");
        costDiv.textContent = itemCosts[item] || "Cost unknown";
        infoRow.appendChild(costDiv);

        // Append the infoRow to the card.
        card.appendChild(infoRow);

        merchantCardsContainer.appendChild(card);
    });

    // Finally, show the modal.
    const merchantModal = document.getElementById("merchantModal");
    if (merchantModal) {
        merchantModal.style.display = "flex";
    }
}

const datePicker = document.getElementById("datePicker") as HTMLInputElement;
datePicker.addEventListener("change", () => {
    if (!datePicker.value) return;

    const selectedDate = new Date(datePicker.value);
    showDetailedStockForDate(selectedDate);
});

const merchantModal = document.getElementById("merchantModal") as HTMLElement;
const merchantModalClose = document.getElementById("merchantModalClose") as HTMLElement;

merchantModalClose.addEventListener("click", () => {
    merchantModal.style.display = "none";
});

// Optionally, close when clicking outside the modal content.
window.addEventListener("click", (event) => {
    if (event.target === merchantModal) {
        merchantModal.style.display = "none";
    }
});

export function scheduleMidnightUpdate(): void {
    const now = new Date();
    // Calculate next midnight in UTC.
    const nextMidnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const msUntilMidnight = nextMidnightUTC.getTime() - now.getTime();

    setTimeout(() => {
        // Call your update function. For example, re-render the 7-day stock table.
        renderStockTable();
        // Reschedule the update for the next midnight UTC.
        scheduleMidnightUpdate();
    }, msUntilMidnight);
}
