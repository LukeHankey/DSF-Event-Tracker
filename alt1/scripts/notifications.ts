import { EventRecord } from "./events";
import { formatTimeLeftValue, getRemainingTime } from "./eventHistory";

let titlebarTimeout: ReturnType<typeof setTimeout> | null = null;
let titlebarInterval: ReturnType<typeof setTimeout> | null = null;
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
        showTooltip(message);
    }

    if (notificationModes.includes("toolbar")) {
        showTitleBarText(event, message, getRemainingTime(event) * 1000);
    }
}

export function setDefaultTitleBar() {
    alt1.setTitleBarText("Listening for DSF events...");
}

function showTooltip(message: string, durationMs: number = 5_000): void {
    alt1.setTooltip(message);

    setTimeout(alt1.clearTooltip, durationMs);
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
        alt1.setTitleBarText(`${message} for ${friendlyRemaining}`);
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
