import { EventRecord } from "./events";
import { formatTimeLeftValue, getRemainingTime } from "./eventHistory";
import { getAllSlots, getRuneDate } from "./merchantStock";

let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
let titlebarTimeout: ReturnType<typeof setTimeout> | null = null;
let titlebarInterval: ReturnType<typeof setTimeout> | null = null;
let activeCheckTimeout: ReturnType<typeof setTimeout> | null = null;
let recentEvent: EventRecord | null = null;

// Function to show toast notification using new BEM modifier for "show"
export function showToast(message: string, type: "error" | "success" = "success"): void {
    const toast = document.createElement("div");
    toast.classList.add("toast");
    if (type === "error") {
        toast.classList.add("toast--error");
    }
    toast.textContent = message;

    document.body.appendChild(toast);

    // Show toast after a brief delay using the BEM modifier
    setTimeout(() => {
        toast.classList.add("toast--show");
    }, 100);

    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove("toast--show");
        setTimeout(() => toast.remove(), 500); // Remove from DOM
    }, 3000);
}

export function notifyEvent(event: EventRecord): void {
    // early return if we aren't in alt1
    if (!window.alt1) {
        return;
    }

    const suppressToday = localStorage.getItem("toggleNotificationsToday") === "true";
    if (suppressToday) {
        alt1.setTitleBarText("");
        return;
    }

    const notificationModes = JSON.parse(localStorage.getItem("notificationModes") ?? "[]");
    const favoriteEventsRaw = localStorage.getItem("favoriteEvents");

    // if favorite events are set, only show the favorites, otherwise, show all
    let favoriteEvents: string[];
    if (favoriteEventsRaw) {
        favoriteEvents = JSON.parse(favoriteEventsRaw);
        if (favoriteEvents.length > 0 && !favoriteEvents.includes(event.event)) {
            return;
        }
    }

    if (!notificationModes || notificationModes.length === 0) {
        return;
    }

    if (
        (event.type === "deleteEvent" || (event.type === "editEvent" && event.duration === 0)) &&
        event.id === recentEvent?.id
    ) {
        const historyRaw = localStorage.getItem("eventHistory");

        if (historyRaw) {
            const history: EventRecord[] = JSON.parse(historyRaw);
            const now = Date.now();

            // find an active event they care about as fallback that isn't the same id
            const fallbackEvent = history.find(
                (e) =>
                    e.id !== event.id &&
                    now < e.timestamp + e.duration * 1000 &&
                    (favoriteEvents.length === 0 || favoriteEvents.includes(e.event)),
            );
            if (fallbackEvent) {
                event = fallbackEvent;
            } else {
                setDefaultTitleBar();
                return;
            }
        } else {
            setDefaultTitleBar();
            return;
        }
    }

    // notification will be sent for this event, set it as the local recentEvent for tracking
    recentEvent = event;

    const message = `${event.event} on w${event.world}`;

    if (notificationModes.includes("tooltip")) {
        const tooltipNotificationSetting = localStorage.getItem("tooltipNotificationSetting");
        let duration = 5_000;
        switch (tooltipNotificationSetting) {
            case "30s":
                duration = 30_000;
                break;
            case "1m":
                duration = 60_000;
                break;
            case "expire": {
                duration = getRemainingTime(event) * 1000;
                let lastKnownInactiveMs = alt1.rsLastActive;
                const minVisibleTime = 2_500;
                const tooltipShownAt = Date.now();
                console.log("Initial rsLastActive (ms since last RS input):", lastKnownInactiveMs);
                if (activeCheckTimeout) {
                    clearInterval(activeCheckTimeout);
                }
                activeCheckTimeout = setInterval(() => {
                    const currentInactiveMs = alt1.rsLastActive;
                    const userReturned = currentInactiveMs < lastKnownInactiveMs;
                    const elapsed = Date.now() - tooltipShownAt;
                    console.log("alt1.rsActive", alt1.rsActive);
                    console.log("alt1.rsLastActive", currentInactiveMs);

                    const shouldClearNow = alt1.rsActive && userReturned && elapsed >= minVisibleTime;

                    if (shouldClearNow) {
                        console.log("User re-activated RuneScape window. Clearing tooltip.");
                        alt1.clearTooltip();

                        if (activeCheckTimeout) {
                            clearInterval(activeCheckTimeout);
                            activeCheckTimeout = null;
                        }

                        if (tooltipTimeout) {
                            clearTimeout(tooltipTimeout);
                            tooltipTimeout = null;
                        }
                    }
                    lastKnownInactiveMs = currentInactiveMs;
                }, 600);
                break;
            }
            default:
                duration = 5_000;
        }
        showTooltip(message, duration);
    }

    if (notificationModes.includes("toolbar")) {
        showTitleBarText(event, message, getRemainingTime(event) * 1000);
    }

    if (notificationModes.includes("system")) {
        alt1.showNotification("DSF Event Tracker", message, "");
    }
}

export function setDefaultTitleBar() {
    alt1.setTitleBarText(`<span title='${getStockTitle()}'>Listening for DSF events...</span>`);
}

function getStockTitle(): string {
    const runedate = getRuneDate();
    const stock = getAllSlots(runedate);
    return `${stock.A}\n${stock.B}\n${stock.C}\n${stock.D}`;
}

function showTooltip(message: string, durationMs: number = 5_000): void {
    alt1.setTooltip(message);

    tooltipTimeout = setTimeout(alt1.clearTooltip, durationMs);
}

function showTitleBarText(event: EventRecord, message: string, durationMs: number = 120_000): void {
    const updateTitle = () => {
        const suppressToday = localStorage.getItem("toggleNotificationsToday") === "true";

        if (suppressToday) {
            alt1.setTitleBarText("");
            if (titlebarInterval) {
                clearInterval(titlebarInterval);
                titlebarInterval = null;
            }
            if (titlebarTimeout) {
                clearTimeout(titlebarTimeout);
                titlebarTimeout = null;
            }
            return;
        }

        const remaining = getRemainingTime(event);
        if (remaining <= 0) {
            alt1.setTitleBarText("");
            if (titlebarInterval) {
                clearInterval(titlebarInterval);
            }
            titlebarInterval = null;
            return;
        }

        const friendlyRemaining = remaining < 60 ? "under 1m" : formatTimeLeftValue(Math.max(remaining, 0), false);
        alt1.setTitleBarText(`<span title='${getStockTitle()}'>${message} for ${friendlyRemaining}</span>`);
    };

    // Immediately update once
    updateTitle();

    // Clear any previous interval/timeout
    if (titlebarInterval) {
        clearInterval(titlebarInterval);
    }
    if (titlebarTimeout) {
        clearTimeout(titlebarTimeout);
    }

    // Start interval to update every half minute
    titlebarInterval = setInterval(updateTitle, 30_000);

    // Final fallback cleanup in case interval missed the end
    titlebarTimeout = setTimeout(() => {
        setDefaultTitleBar();
        if (titlebarInterval) {
            clearInterval(titlebarInterval);
        }
        titlebarInterval = null;
        titlebarTimeout = null;
    }, durationMs);
}
