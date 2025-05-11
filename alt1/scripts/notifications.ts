import { EventRecord } from "./events";
import {formatTimeLeftValue, getRemainingTime} from './eventHistory';

export type NotificationModes = "none" | "tooltip" | "toolbar" | "all";

let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
let titlebarTimeout: ReturnType<typeof setTimeout> | null = null;
let titlebarInterval: ReturnType<typeof setTimeout> | null = null;

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
    console.log('notified', event);
    // early return if we aren't in alt1
    if (!window.alt1) {
        return;
    }

    const notificationModes = localStorage.getItem("notificationModes") as NotificationModes[] | null;
    const favoriteEventsRaw = localStorage.getItem("favoriteEvents");

    console.log('mode', notificationModes);
    console.log('favorites', favoriteEventsRaw);

    // if favorite events are set, only show the favorites, otherwise, show all
    if (favoriteEventsRaw) {
        const favoriteEvents: string[] = JSON.parse(favoriteEventsRaw);
        if (favoriteEvents.length > 0 && !favoriteEvents.includes(event.event)) {
            return;
        }
    }

    if (!notificationModes || notificationModes.length === 0) {
        return;
    }

    const message = `${event.event} on w${event.world}`;

    if (notificationModes.includes("tooltip")) {
        showTooltip(message);
    }

    if (notificationModes.includes("toolbar")) {
        showTitleBarText(event, `${message}`, event.duration * 1000);
    }
}

export function showTooltip(message: string, time: number = 5000): void {
    alt1.setTooltip(message);

    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
    }

    tooltipTimeout = setTimeout(() => {
        alt1.clearTooltip();
    }, time);
}


export function showTitleBarText(event: EventRecord, message: string, duration: number = 120000): void {
    const updateTitle = () => {
        const remaining = getRemainingTime(event);

        if (remaining <= 0) {
            alt1.setTitleBarText('');
            if (titlebarInterval) {
                clearInterval(titlebarInterval);
            }
            titlebarInterval = null;
            return;
        }

        const friendlyRemaining =
            remaining < 60
                ? "under a minute"
                : formatTimeLeftValue(Math.max(remaining, 0), false);
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

    // Start interval to update every second
    titlebarInterval = setInterval(updateTitle, 60000);

    // Final clear (in case interval missed the exact end)
    titlebarTimeout = setTimeout(() => {
        alt1.setTitleBarText('');
        if (titlebarInterval) {
            clearInterval(titlebarInterval);
        }
        titlebarInterval = null;
        titlebarTimeout = null;
    }, duration);
}