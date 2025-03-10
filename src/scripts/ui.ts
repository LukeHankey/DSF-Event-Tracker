import {
    startEventTimerRefresh,
    stopEventTimerRefresh,
    renderEventHistory,
    clearEventHistory,
    updateHideExpiredRows,
} from "./eventHistory";
import { EventRecord } from "./events";
import { wsClient } from "./ws";
import { DEBUG } from "../config";
import { v4 as uuid } from "uuid";

// You can define a union type for the status if you like:
type StatusType = "ok" | "warning" | "error";

// Grab all tabs as HTMLElements using the new BEM class name
const tabs = document.querySelectorAll<HTMLElement>(".tabs__tab");
tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        // Remove active state from the currently active tab
        const activeTab = document.querySelector<HTMLElement>(
            ".tabs__tab.tabs__tab--active",
        );
        if (activeTab) {
            activeTab.classList.remove("tabs__tab--active");
        }

        // Remove active state from the currently active content
        const activeContent = document.querySelector<HTMLElement>(
            ".tabs__content.tabs__content--active",
        );
        if (activeContent) {
            activeContent.classList.remove("tabs__content--active");
        }

        // Add active state to the clicked tab
        tab.classList.add("tabs__tab--active");

        // Find the tab's target content via data-tab attribute
        const targetTabId = tab.dataset.tab;
        if (targetTabId) {
            const targetElement = document.getElementById(targetTabId);
            if (targetElement) {
                targetElement.classList.add("tabs__content--active");
            }

            // If the Scouts tab is not active, ensure the event timer is stopped.
            if (targetTabId !== "scoutsTab") {
                stopEventTimerRefresh();
            } else {
                // If Scouts is active, check the currently active sub-tab.
                const activeSubTab = targetElement.querySelector(
                    ".sub-tab.sub-tab--active",
                );
                if (
                    activeSubTab &&
                    activeSubTab.getAttribute("data-subtab") ===
                        "eventHistoryTab"
                ) {
                    startEventTimerRefresh();
                } else {
                    stopEventTimerRefresh();
                }
            }
        }
    });
});

// Function to show toast notification using new BEM modifier for "show"
function showToast(message: string): void {
    const toast = document.createElement("div");
    toast.classList.add("toast");
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

// Query the status tab and notification
const statusTab = document.querySelector<HTMLElement>('[data-tab="statusTab"]');
const statusNotification = document.getElementById(
    "statusNotification",
) as HTMLElement | null;

// Function to update status dynamically using new BEM classes for status
function updateStatus(status: StatusType): void {
    const statusMessage = document.getElementById(
        "statusMessage",
    ) as HTMLElement | null;
    const statusIcon = document.getElementById(
        "statusIcon",
    ) as HTMLElement | null;
    if (!statusMessage || !statusIcon) return;

    // Set base class for the status icon
    statusIcon.className = "status__icon";

    // Set new status based on value and add the appropriate modifier
    if (status === "ok") {
        statusIcon.textContent = "✅";
        statusMessage.textContent = "Everything is running smoothly.";
        statusIcon.classList.add("status--ok");
    } else if (status === "warning") {
        statusIcon.textContent = "⚠️";
        statusMessage.textContent = "There might be minor issues.";
        statusIcon.classList.add("status--warning");
    } else if (status === "error") {
        statusIcon.textContent = "❌";
        statusMessage.textContent = "Critical issues detected!";
        statusIcon.classList.add("status--error");
    }

    // Show notification dot if not already on the Status tab
    if (
        statusTab &&
        !statusTab.classList.contains("tabs__tab--active") &&
        statusNotification
    ) {
        statusNotification.style.display = "inline-block";
    }
}

// Hide notification when the user clicks on the Status tab
statusTab?.addEventListener("click", () => {
    if (statusNotification) {
        statusNotification.style.display = "none"; // Hide the notification
    }
});

// Simulate a backend status update (replace with a real API call)
setTimeout(() => {
    // Change this value to "warning" or "error" to test different states
    updateStatus("ok");
}, 5000);

// Load settings from localStorage, if available
const discordIDInput = document.getElementById(
    "discordID",
) as HTMLInputElement | null;
const savedDiscordID = localStorage.getItem("discordID");
if (discordIDInput && savedDiscordID) {
    discordIDInput.value = savedDiscordID;
}

const rsnInput = document.getElementById("rsn") as HTMLInputElement | null;
const savedRSN = localStorage.getItem("rsn");
if (rsnInput && savedRSN) {
    rsnInput.value = savedRSN;
}

const captureFrequency = document.getElementById(
    "captureFrequency",
) as HTMLInputElement | null;
const savedCaptureFrequency = localStorage.getItem("captureFrequency");
if (captureFrequency && savedCaptureFrequency) {
    captureFrequency.value = savedCaptureFrequency;
}

const favoriteEventsSelect = document.getElementById(
    "favoriteEvents",
) as HTMLSelectElement | null;
const savedFavoriteEvents = localStorage.getItem("favoriteEvents");
if (savedFavoriteEvents && favoriteEventsSelect) {
    const favorites: string[] = JSON.parse(savedFavoriteEvents);
    // Mark these options as selected
    Array.from(favoriteEventsSelect.options).forEach((option) => {
        option.selected = favorites.includes(option.value);
    });
}

const favoriteEventsModeSelect = document.getElementById(
    "favoriteEventsMode",
) as HTMLSelectElement | null;
const savedFavMode = localStorage.getItem("favoriteEventsMode");
if (favoriteEventsModeSelect && savedFavMode) {
    favoriteEventsModeSelect.value = savedFavMode;
}

function updateIfChanged(key: string, currentValue: string): void {
    const savedValue = localStorage.getItem(key);
    if (savedValue !== currentValue) {
        localStorage.setItem(key, currentValue);
        if (key === "favoriteEventsMode") renderEventHistory();
    }
}

// Handle settings form submission and save to localStorage
const settingsForm = document.getElementById(
    "settingsForm",
) as HTMLFormElement | null;
settingsForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (discordIDInput) {
        updateIfChanged("discordID", discordIDInput.value);
    }
    if (rsnInput) {
        updateIfChanged("rsn", rsnInput.value);
    }
    if (captureFrequency) {
        updateIfChanged("captureFrequency", captureFrequency.value);
    }

    if (favoriteEventsSelect) {
        const selectedValues = Array.from(
            favoriteEventsSelect.selectedOptions,
        ).map((opt) => opt.value);
        updateIfChanged("favoriteEvents", JSON.stringify(selectedValues));
    }

    if (favoriteEventsModeSelect) {
        updateIfChanged("favoriteEventsMode", favoriteEventsModeSelect.value);
    }

    // Show success toast notification
    showToast("✅ Settings saved!");
});

// Sub-tab switching inside #scoutsTab
const sub_tabs = document.querySelectorAll<HTMLElement>(".sub-tab");
sub_tabs.forEach((subTab) => {
    subTab.addEventListener("click", () => {
        // Remove .sub-tab--active from any active sub-tab
        const activeSubTab = document.querySelector(".sub-tab.sub-tab--active");
        if (activeSubTab) {
            activeSubTab.classList.remove("sub-tab--active");
        }

        // Hide the currently active sub-tab-content
        const activeContent = document.querySelector(
            ".sub-tab__content.sub-tab__content--active",
        );
        if (activeContent) {
            activeContent.classList.remove("sub-tab__content--active");
        }

        // Add active state to clicked sub-tab
        subTab.classList.add("sub-tab--active");

        // Show the corresponding content
        const targetId = subTab.dataset.subtab;
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.classList.add("sub-tab__content--active");
        }

        // If the event history sub-tab is active, start the timer, otherwise stop it.
        if (targetId === "eventHistoryTab") {
            startEventTimerRefresh();
        } else {
            stopEventTimerRefresh();
        }
    });
});

const hideExpiredCheckbox = document.getElementById(
    "hideExpiredCheckbox",
) as HTMLInputElement | null;
if (hideExpiredCheckbox) {
    hideExpiredCheckbox.addEventListener("change", () => {
        updateHideExpiredRows();
    });
}

const clearAllBtn = document.getElementById(
    "clearHistoryBtn",
) as HTMLButtonElement | null;
if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => clearEventHistory());
}

// When you click the test button, emit the "updateEventHistory" event with your payload.
const testEventButton = document.getElementById("testWS");
if (testEventButton && DEBUG) {
    testEventButton.addEventListener("click", () => {
        const lastEvent = JSON.parse(
            localStorage.getItem("eventHistory"),
        ).slice(-1)[0] as EventRecord;
        const lastEventTimestamp = lastEvent?.timestamp || 0;
        const lastEventId = lastEvent?.id;
        wsClient.sendSync(lastEventTimestamp, lastEventId);

        const testEvent: EventRecord = {
            id: uuid(),
            type: "testing",
            event: "Testing",
            world: "50",
            duration: 15,
            reportedBy: "Test",
            timestamp: Date.now(),
            oldEvent: null,
        };
        console.log("Emitting event_data", testEvent);
        wsClient.send(testEvent);
    });
}

// When the page loads, hide the debug container if not in debug mode.
window.addEventListener("DOMContentLoaded", () => {
    const debugContainer = document.getElementById("debugContainer");
    if (debugContainer) {
        if (!DEBUG) {
            debugContainer.style.display = "none";
        } else {
            debugContainer.style.display = ""; // or "block"
        }
    }
    const infoButton = document.getElementById("infoButton");
    const modal = document.getElementById("infoModal");
    const closeModal = modal.querySelector(".close");

    // Show the modal when the info button is clicked
    infoButton.addEventListener("click", function () {
        modal.style.display = "block";
    });

    // Hide the modal when the close button (×) is clicked
    closeModal.addEventListener("click", function () {
        modal.style.display = "none";
    });

    // Hide the modal when clicking outside of the modal content
    window.addEventListener("click", function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });
});
