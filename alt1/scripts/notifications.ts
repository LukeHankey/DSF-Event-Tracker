import { eventAbbreviations, EventRecord } from "./events";
import { formatTimeLeftValue, getEndTime, getRemainingTime, getSpecialWorld } from "./eventHistory";
import { API_URL } from "../config";

type StatusState = {
    forDay: string;
    stock: Record<"A" | "B" | "C" | "D", { slot: string; title: string; icon: string }>;
};

type NotifiedEvent = {
    message: string;
    endTime: number;
} & EventRecord;

type NotificationSettings = {
    suppressToday: boolean;
    useAbbreviatedCall: boolean;
    notificationModes: string[];
    favoriteEvents: string[];
    tooltipNotification: string;
};

let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
let notificationTimeout: ReturnType<typeof setTimeout> | null = null;
let titlebarInterval: ReturnType<typeof setTimeout> | null = null;
let activeCheckTimeout: ReturnType<typeof setTimeout> | null = null;

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

function getNotificationSettings(): NotificationSettings {
    const suppressToday = localStorage.getItem("toggleNotificationsToday") === "true";
    const notificationModes = JSON.parse(localStorage.getItem("notificationModes") ?? "[]");
    const useAbbreviatedCall = localStorage.getItem("useAbbreviatedCall") === "true";
    const favoriteEvents = JSON.parse(localStorage.getItem("favoriteEvents") ?? "[]");
    const tooltipNotification = localStorage.getItem("tooltipNotificationSetting") ?? "default";
    return {
        suppressToday,
        useAbbreviatedCall,
        notificationModes,
        favoriteEvents,
        tooltipNotification,
    };
}

export function notifyEvent(event: EventRecord): void {
    // early return if we aren't in alt1
    if (!window.alt1) {
        return;
    }
    const { suppressToday, notificationModes, useAbbreviatedCall, favoriteEvents, tooltipNotification } =
        getNotificationSettings();
    if (suppressToday) {
        setDefaultTitleBar();
        return;
    }

    // if favorite events are set, only show the favorites, otherwise, show all
    if (favoriteEvents.length > 0 && !favoriteEvents.includes(event.event)) {
        return;
    }

    if (!notificationModes || notificationModes.length === 0) {
        return;
    }

    const recentEvent = getNotifiedEvent();

    if (
        (event.type === "deleteEvent" || (event.type === "editEvent" && event.duration === 0)) &&
        event.id === recentEvent?.id
    ) {
        const fallbackEvent = getActiveEvent();
        if (fallbackEvent && fallbackEvent.id !== recentEvent?.id) {
            event = fallbackEvent;
        } else {
            setDefaultTitleBar();
            return;
        }
    }

    // notification will be sent for this event, set it as the notifiedEvent for tracking
    localStorage.setItem("notifiedEvent", JSON.stringify({ ...event }));

    const message = useAbbreviatedCall
        ? `${eventAbbreviations[event.event]}${event.world}`
        : `${event.event} on w${event.world}`;

    const durationMs = getRemainingTime(event) * 1000;

    if (notificationModes.includes("tooltip")) {
        let duration = 5_000;
        switch (tooltipNotification) {
            case "30s":
                duration = 30_000;
                break;
            case "1m":
                duration = 60_000;
                break;
            case "expire": {
                duration = durationMs;
                let lastKnownInactiveMs = alt1.rsLastActive;
                const minVisibleTime = 2_500;
                const tooltipShownAt = Date.now();
                if (activeCheckTimeout) {
                    clearInterval(activeCheckTimeout);
                }
                activeCheckTimeout = setInterval(() => {
                    const currentInactiveMs = alt1.rsLastActive;
                    const userReturned = currentInactiveMs < lastKnownInactiveMs;
                    const elapsed = Date.now() - tooltipShownAt;

                    const shouldClearNow = alt1.rsActive && userReturned && elapsed >= minVisibleTime;

                    if (shouldClearNow) {
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
        showTitleBarText(event, message);
    }

    if (notificationModes.includes("system")) {
        alt1.showNotification("DSF Event Tracker", message, "");
    }

    if (notificationModes.includes("audio")) {
        const audio = new Audio("./assets/sounds/notification.mp3");
        audio.play();
    }

    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    notificationTimeout = setTimeout(() => {
        setDefaultTitleBar();
        const active = getActiveEvent();
        if (active && active.id !== event.id) {
            notifyEvent(active);
        }
        if (titlebarInterval) {
            clearInterval(titlebarInterval);
        }
        titlebarInterval = null;
        notificationTimeout = null;
    }, durationMs);
}

export function registerStatusUpdates() {
    const notificationModes: string[] = JSON.parse(localStorage.getItem("notificationModes") ?? "[]");
    if (API_URL && notificationModes?.includes("toolbar")) {
        const settings = getNotificationSettings();
        alt1.registerStatusDaemon(`${API_URL}/merchant-stock/notify`, JSON.stringify({ settings }));
    }
}

function getActiveEvent() {
    const { favoriteEvents } = getNotificationSettings();
    const history = JSON.parse(localStorage.getItem("eventHistory") ?? "[]") as EventRecord[];
    const now = Date.now();

    // find an active event they care about
    return history?.find(
        (e) =>
            now < e.timestamp + e.duration * 1000 && (favoriteEvents.length === 0 || favoriteEvents.includes(e.event)),
    );
}

function getNotifiedEvent(): NotifiedEvent | null {
    const notiRaw = localStorage.getItem("notifiedEvent");
    return notiRaw ? JSON.parse(notiRaw) : null;
}

function getSpecialWorldIcon(world: string): string {
    const specialWorld = getSpecialWorld(world);
    return specialWorld ? `<img height='100' width='100' src='${specialWorld.imageSrc}' />` : "";
}

export function updateTitlebar() {
    const notifiedEvent = getNotifiedEvent();
    if (notifiedEvent && notifiedEvent.endTime > Date.now()) {
        const stock = buildStockFromState();
        let builder = stock.length > 0 ? `${stock}<vr/>` : stock;
        builder += `${getSpecialWorldIcon(notifiedEvent.world)}${notifiedEvent.message}`;
        alt1.setTitleBarText(builder);
    } else {
        setDefaultTitleBar();
    }
}

function buildStockFromState(): string {
    let builder = "";
    let state: StatusState | null = null;
    try {
        state = JSON.parse(alt1.getStatusDaemonState() || "{}") as StatusState;
    } catch (e) {
        // Optionally log the error, e.g. console.error("Failed to parse status daemon state", e);
        return builder;
    }
    const stock = state?.stock;
    if (!stock) {
        return builder;
    }
    (["A", "B", "C", "D"] as const).forEach((slot) => {
        const slotValue = stock[slot];
        builder += `<img height='100' width='100' title='${slotValue.title}' src='${slotValue.icon}' />`;
    });

    return builder;
}

export function setDefaultTitleBar() {
    alt1.setTitleBarText(buildStockFromState());
}

function showTooltip(message: string, durationMs: number = 5_000): void {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
    }

    alt1.setTooltip(message);

    tooltipTimeout = setTimeout(alt1.clearTooltip, durationMs);
}

function showTitleBarText(event: EventRecord, message: string): void {
    const updateTitle = () => {
        const suppressToday = localStorage.getItem("toggleNotificationsToday") === "true";
        const remaining = getRemainingTime(event);

        const cleanup = () => {
            setDefaultTitleBar();
            if (titlebarInterval) {
                clearInterval(titlebarInterval);
                titlebarInterval = null;
            }
            if (notificationTimeout) {
                clearTimeout(notificationTimeout);
                notificationTimeout = null;
            }
        };

        if (suppressToday || remaining <= 0) {
            cleanup();
            return;
        }

        const friendlyRemaining = remaining < 60 ? "under 1m" : formatTimeLeftValue(Math.max(remaining, 0), false);
        const titlebarText = `${message} for ${friendlyRemaining}`;
        const notifiedEvent: NotifiedEvent = {
            ...event,
            message: titlebarText,
            endTime: getEndTime(event),
        };

        localStorage.setItem("notifiedEvent", JSON.stringify(notifiedEvent));
        updateTitlebar();
    };

    // Immediately update once
    updateTitle();

    // Clear any previous intervals
    if (titlebarInterval) {
        clearInterval(titlebarInterval);
    }

    // Start interval to update every half minute
    titlebarInterval = setInterval(updateTitle, 30_000);
}
