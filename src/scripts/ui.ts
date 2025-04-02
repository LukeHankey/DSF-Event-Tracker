import {
    startEventTimerRefresh,
    stopEventTimerRefresh,
    renderEventHistory,
    clearEventHistory,
    updateHideExpiredRows,
    MEMBER_WORLDS,
} from "./eventHistory";
import { EventKeys, EventRecord, eventTimes } from "./events";
import { wsClient, refreshToken } from "./ws";
import { DEBUG, ORIGIN, API_URL } from "../config";
import { v4 as uuid, UUIDTypes } from "uuid";
import axios from "axios";
import { showToast } from "./notifications";
import { renderStockTable } from "./merchantStock";

// You can define a union type for the status if you like:
type StatusType = "ok" | "warning" | "error";

// Grab all tabs as HTMLElements using the new BEM class name
const tabs = document.querySelectorAll<HTMLElement>(".tabs__tab");
tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        // Remove active state from the currently active tab
        const activeTab = document.querySelector<HTMLElement>(".tabs__tab.tabs__tab--active");
        if (activeTab) {
            activeTab.classList.remove("tabs__tab--active");
        }

        // Remove active state from the currently active content
        const activeContent = document.querySelector<HTMLElement>(".tabs__content.tabs__content--active");
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
                if (targetElement) {
                    // If Scouts is active, check the currently active sub-tab.
                    const activeSubTab = targetElement.querySelector(".sub-tab.sub-tab--active");
                    if (activeSubTab && activeSubTab.getAttribute("data-subtab") === "eventHistoryTab") {
                        startEventTimerRefresh();
                    } else {
                        stopEventTimerRefresh();
                    }
                }
            }
        }
    });
});

// Query the status tab and notification
const statusTab = document.querySelector<HTMLElement>('[data-tab="statusTab"]');
const statusNotification = document.getElementById("statusNotification") as HTMLElement | null;

// Function to update status dynamically using new BEM classes for status
function updateStatus(status: StatusType): void {
    const statusMessage = document.getElementById("statusMessage") as HTMLElement | null;
    const statusIcon = document.getElementById("statusIcon") as HTMLElement | null;
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
    if (statusTab && !statusTab.classList.contains("tabs__tab--active") && statusNotification) {
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
const discordIDInput = document.getElementById("discordID") as HTMLInputElement | null;
const savedDiscordID = localStorage.getItem("discordID");
if (discordIDInput && savedDiscordID) {
    discordIDInput.value = savedDiscordID;
}

const rsnInput = document.getElementById("rsn") as HTMLInputElement | null;

const captureFrequency = document.getElementById("captureFrequency") as HTMLInputElement | null;
const savedCaptureFrequency = localStorage.getItem("captureFrequency");
if (captureFrequency && savedCaptureFrequency) {
    captureFrequency.value = savedCaptureFrequency;
}

const favoriteEventsSelect = document.getElementById("favoriteEvents") as HTMLSelectElement | null;
const savedFavoriteEvents = localStorage.getItem("favoriteEvents");
if (savedFavoriteEvents && favoriteEventsSelect) {
    const favorites: string[] = JSON.parse(savedFavoriteEvents);
    // Mark these options as selected
    Array.from(favoriteEventsSelect.options).forEach((option) => {
        option.selected = favorites.includes(option.value);
    });
}

const favoriteEventsModeSelect = document.getElementById("favoriteEventsMode") as HTMLSelectElement | null;
const savedFavMode = localStorage.getItem("favoriteEventsMode");
if (favoriteEventsModeSelect && savedFavMode) {
    favoriteEventsModeSelect.value = savedFavMode;
}

function updateIfChanged(key: string, currentValue: string): void {
    const savedValue = localStorage.getItem(key);
    if (savedValue !== currentValue) {
        localStorage.setItem(key, currentValue);
        if (key === "favoriteEventsMode" || key === "favoriteEvents") renderEventHistory();
    }
}

// Handle settings form submission and save to localStorage
const settingsForm = document.getElementById("settingsForm") as HTMLFormElement | null;
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
        const selectedValues = Array.from(favoriteEventsSelect.selectedOptions).map((opt) => opt.value);
        updateIfChanged("favoriteEvents", JSON.stringify(selectedValues));
    }

    if (favoriteEventsModeSelect) {
        updateIfChanged("favoriteEventsMode", favoriteEventsModeSelect.value);
    }

    // Show success toast notification
    showToast("✅ Settings saved!");
});

document.getElementById("validateDiscordID")?.addEventListener("click", async () => {
    const discordID = (document.getElementById("discordID") as HTMLInputElement).value;
    const validationMessage = document.getElementById("validationMessage");

    if (!discordID.match(/^\d{17,20}$/)) {
        validationMessage!.textContent = "Invalid Discord ID format.";
        validationMessage!.style.color = "red";
        return;
    }

    try {
        const response = await axios.post(`${API_URL}/auth/validate/${discordID}`, {
            headers: {
                "Content-Type": "application/json",
                Origin: ORIGIN,
            },
        });

        if (response.status === 200 && response.data.exists) {
            validationMessage!.textContent = "✅ Run /alt1 verify in Discord.";
            validationMessage!.style.display = "block";
            validationMessage!.style.color = "green";
            updateIfChanged("discordID", discordID);
            document.getElementById("verificationSection")!.style.display = "block";
        }
    } catch (err) {
        console.error("Error validating Discord ID:", err);
        validationMessage!.textContent = "❌ Error validating Discord ID.";
        validationMessage!.style.color = "red";
    }
});

// Step 2: Handle verification code input
document.getElementById("submitVerificationCode")?.addEventListener("click", async () => {
    const discordID = (document.getElementById("discordID") as HTMLInputElement).value;
    const verificationCode = (document.getElementById("verificationCode") as HTMLInputElement).value;
    const verificationSection = document.getElementById("verificationSection");
    const verificationMessage = document.getElementById("verificationMessage");

    const validationMessage = document.getElementById("validationMessage");

    if (!verificationCode.match(/^\d{8}$/)) {
        verificationMessage!.textContent = "Invalid verification code.";
        verificationMessage!.style.display = "block";
        verificationMessage!.style.color = "red";
        return;
    }

    const response = await axios.post(`${API_URL}/auth/verify/${discordID}?code=${verificationCode}`, {
        headers: {
            "Content-Type": "application/json",
            Origin: ORIGIN,
        },
    });

    if (response.data.verified && response.data.refresh_token) {
        // Hide verification section
        verificationSection!.style.display = "none";
        validationMessage!.style.display = "none";
        verificationMessage!.style.display = "none";

        localStorage.setItem("refreshToken", response.data.refresh_token);
        localStorage.setItem("accessToken", response.data.access_token);

        // Update discord_id to websocket and load profile
        wsClient.reconnect();

        // Show success toast
        showToast("✅ Verified successfully!");
    } else {
        verificationMessage!.textContent = "❌ Incorrect verification code.";
        verificationMessage!.style.color = "red";
    }
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
        const activeContent = document.querySelector(".sub-tab__content.sub-tab__content--active");
        if (activeContent) {
            activeContent.classList.remove("sub-tab__content--active");
        }

        // Add active state to clicked sub-tab
        subTab.classList.add("sub-tab--active");

        // Show the corresponding content
        const targetId = subTab.dataset.subtab as string;
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.classList.add("sub-tab__content--active");
        }

        // If the event history sub-tab is active, start the timer, otherwise stop it.
        if (targetId === "eventHistoryTab") {
            document.getElementById("eventHistoryWrapper")!.style.display = "flex";
            startEventTimerRefresh();
        } else {
            document.getElementById("eventHistoryWrapper")!.style.display = "none";
            stopEventTimerRefresh();
        }
    });
});

const hideExpiredCheckbox = document.getElementById("hideExpiredCheckbox") as HTMLInputElement | null;
if (hideExpiredCheckbox) {
    hideExpiredCheckbox.addEventListener("change", () => {
        updateHideExpiredRows();
    });
}

function showConfirmationModal({
    title = "Confirm",
    message = "Are you sure you want to proceed?",
    confirmText = "Yes",
    onConfirm,
}: {
    title?: string;
    message?: string;
    confirmText?: string;
    onConfirm: () => void;
}) {
    const modal = document.getElementById("confirmModal") as HTMLElement;
    const closeBtn = document.getElementById("confirmModalClose")!;
    const yesBtn = document.getElementById("confirmModalYes")!;
    const noBtn = document.getElementById("confirmModalNo")!;
    const modalTitle = document.getElementById("confirmModalTitle")!;
    const modalMessage = document.getElementById("confirmModalMessage")!;

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    yesBtn.textContent = confirmText;

    modal.style.display = "block";

    const cleanup = () => {
        modal.style.display = "none";
        yesBtn.removeEventListener("click", confirmHandler);
        noBtn.removeEventListener("click", cleanup);
        closeBtn.removeEventListener("click", cleanup);
        window.removeEventListener("click", outsideClickHandler);
    };

    const confirmHandler = () => {
        onConfirm();
        cleanup();
    };

    const outsideClickHandler = (event: MouseEvent) => {
        if (event.target === modal) {
            cleanup();
        }
    };

    yesBtn.addEventListener("click", confirmHandler);
    noBtn.addEventListener("click", cleanup);
    closeBtn.addEventListener("click", cleanup);
    window.addEventListener("click", outsideClickHandler);
}

const clearAllBtn = document.getElementById("clearHistoryBtn") as HTMLButtonElement | null;
if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
        showConfirmationModal({
            title: "Confirm Clear",
            message: "Are you sure you want to clear your entire event history? This cannot be undone.",
            confirmText: "Yes, clear it",
            onConfirm: () => clearEventHistory(),
        });
    });
}

// When you click the test button, emit the "updateEventHistory" event with your payload.
const testEventButton = document.getElementById("testWS");
const eventSelect = document.getElementById("testEventSelect") as HTMLSelectElement; // Dropdown for event selection
if (testEventButton && DEBUG) {
    testEventButton.addEventListener("click", () => {
        const eventHistory = localStorage.getItem("eventHistory");
        const token = localStorage.getItem("accessToken");
        if (!eventHistory) {
            const addTestEvent: EventRecord = {
                id: uuid(),
                type: "addEvent",
                event: "Testing",
                world: "105",
                duration: 15,
                reportedBy: "Me",
                timestamp: Date.now(),
                oldEvent: null,
                token: token,
                source: "alt1",
                profileEventKey: "alt1First.otherCount",
            };
            localStorage.setItem("eventHistory", JSON.stringify([addTestEvent]));
        }
        const lastEvent = JSON.parse(localStorage.getItem("eventHistory")!).slice(-1)[0] as EventRecord;
        const lastEventTimestamp = lastEvent?.timestamp || 0;
        const lastEventId = lastEvent?.id;
        wsClient.sendSync(lastEventTimestamp, lastEventId);

        // Get user-selected event
        const selectedEvent = (eventSelect.value as EventKeys) || "Testing";
        const eventDuration = eventTimes[selectedEvent] ?? 15; // Default to 15 if not found
        const randomWorld = MEMBER_WORLDS[Math.floor(Math.random() * MEMBER_WORLDS.length)];

        const testEvent: EventRecord = {
            id: uuid(),
            type: "addEvent",
            event: selectedEvent,
            world: randomWorld,
            duration: eventDuration + 6,
            reportedBy: "Test",
            timestamp: Date.now(),
            oldEvent: null,
            token: token,
            source: "alt1",
            profileEventKey: "alt1First.otherCount",
        };
        console.log("Emitting event_data", testEvent);
        wsClient.send(testEvent);
    });
}

function populateEventDropdown() {
    const eventSelect = document.getElementById("testEventSelect") as HTMLSelectElement;
    if (!eventSelect) return;

    Object.entries(eventTimes).forEach(([eventName, duration]) => {
        const option = document.createElement("option");
        option.value = eventName;
        option.textContent = `${eventName} (${duration / 60}m)`;
        eventSelect.appendChild(option);
    });
}

// When the page loads, hide the debug container if not in debug mode.
window.addEventListener("DOMContentLoaded", () => {
    renderStockTable();
    const debugContainer = document.getElementById("debugContainer");
    if (debugContainer) {
        if (!DEBUG) {
            debugContainer.style.display = "none";
        } else {
            debugContainer.style.display = ""; // or "block"
            populateEventDropdown();
        }
    }
    const infoButton = document.getElementById("infoButton") as HTMLElement;
    const modal = document.getElementById("infoModal") as HTMLElement;
    const closeModal = modal.querySelector(".close") as Element;

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

    // Assume the input field has an id of 'rsn-input'
    const rsnInput = document.getElementById("rsn") as HTMLInputElement | null;
    if (!rsnInput) return;

    // First, check if there's a user-set RSN in localStorage
    const savedRSN = localStorage.getItem("rsn") || sessionStorage.getItem("rsn");
    if (savedRSN) {
        rsnInput.value = savedRSN;
    }

    // When the user changes the input, store the new RSN in localStorage
    rsnInput.addEventListener("change", () => {
        const newRSN = rsnInput.value;
        if (newRSN) {
            localStorage.setItem("rsn", newRSN);
        } else {
            // Optionally, remove the value if the user clears the field
            localStorage.removeItem("rsn");
        }
    });
});

declare global {
    interface Window {
        openModActionModal: (eventId: UUIDTypes) => void;
    }
}

const modModal = document.getElementById("modActionModal") as HTMLElement;
const closeBtn = document.getElementById("modActionClose")!;
const modGlobalDeleteBtn = document.getElementById("modGlobalDeleteBtn")!;

// Show the modal and store the event ID
window.openModActionModal = (eventId: UUIDTypes) => {
    modModal.style.display = "block";
    modModal.dataset.eventId = String(eventId);
};

const closeModal = () => {
    modModal.style.display = "none";
};

closeBtn.addEventListener("click", closeModal);

window.addEventListener("click", (event) => {
    if (event.target === modModal) {
        closeModal();
    }
});

modGlobalDeleteBtn.addEventListener("click", () => {
    const eventId = modModal.dataset.eventId as UUIDTypes | undefined;
    if (!eventId) return;

    modModal.style.display = "none"; // 👈 hide the mod modal first

    const confirmAndDelete = async () => {
        const eventHistory: EventRecord[] = JSON.parse(localStorage.getItem("eventHistory") ?? "[]");
        const event = eventHistory.find((e) => e.id === eventId);
        if (!event) return;

        const token = localStorage.getItem("accessToken")
        const eventToSend = { ...event, type: "deleteEvent", token } as EventRecord;

        try {
            await axios.delete(`${API_URL}/worlds/${eventToSend.world}/event`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${eventToSend.token}`,
                },
            });
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error(error);
                const status = error.response?.status;
                const message = error.response?.data?.detail;
                if (status === 401 && message === 'Token has expired') {
                    await refreshToken();
                    await confirmAndDelete();
                } else {
                    return showToast(message, "error")
                }
            } else {
                console.error("Unexpected error", error);
            }
        }

        wsClient.send(eventToSend);
    };

    showConfirmationModal({
        title: "Confirm Global Delete",
        message: "Are you sure you want to remove this event from all clients?",
        confirmText: "Delete for All",
        onConfirm: confirmAndDelete,
    });
});
