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
import { renderMistyTimers } from "./mistyTimers";

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

const notificationModesSelect = document.getElementById("notificationModes") as HTMLSelectElement | null;
const notificationModes = localStorage.getItem("notificationModes");
if (notificationModes && notificationModesSelect) {
    const favorites: string[] = JSON.parse(notificationModes);
    // Mark these options as selected
    Array.from(notificationModesSelect.options).forEach((option) => {
        option.selected = favorites.includes(option.value);
    });
}

const darkModeSwitch = document.getElementById("darkMode") as HTMLInputElement | null;
const darkMode = localStorage.getItem("darkMode");
if (darkModeSwitch && darkMode) {
    darkModeSwitch.checked = darkMode === "true";
}

function updateIfChanged(key: string, currentValue: string): void {
    const savedValue = localStorage.getItem(key);
    if (savedValue !== currentValue) {
        localStorage.setItem(key, currentValue);
        if (key === "favoriteEventsMode" || key === "favoriteEvents") renderEventHistory();
    }
}

function setDarkMode(): void {
    const isDarkMode = localStorage.getItem("darkMode") === "true";
    document.body.classList.toggle("dark-mode", isDarkMode);
}

setDarkMode();

// Handle reset notification modes
const resetNotificationModes = document.getElementById("resetNotificationModes") as HTMLAnchorElement | null;
resetNotificationModes?.addEventListener("click", () => {
    if (notificationModesSelect) {
        // Clear all selected options
        Array.from(notificationModesSelect.options).forEach((option) => {
            option.selected = false;
        });

        // Update localStorage to reflect empty state
        localStorage.setItem("notificationModes", JSON.stringify([]));
    }
});

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

    if (notificationModesSelect) {
        const selectedValues = Array.from(notificationModesSelect.selectedOptions).map((opt) => opt.value);
        console.log("selected modes", selectedValues);
        updateIfChanged("notificationModes", JSON.stringify(selectedValues));
    }

    if (darkModeSwitch) {
        updateIfChanged("darkMode", darkModeSwitch.checked.toString());
    }

    setDarkMode();

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
        await renderMistyTimers();

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
    const storedState = localStorage.getItem("hideExpiredRows");
    hideExpiredCheckbox.checked = storedState === "true";

    hideExpiredCheckbox.addEventListener("change", (e) => {
        const checkbox = e.target as HTMLInputElement;
        localStorage.setItem("hideExpiredRows", checkbox.checked ? "true" : "false");
        updateHideExpiredRows();
    });
}

const toggleMistyTimer = document.getElementById("toggleMistyTimer") as HTMLInputElement | null;
if (toggleMistyTimer) {
    // Initialize the toggle from localStorage (defaults to unchecked if not set)
    const storedState = localStorage.getItem("toggleMistyTimer");
    toggleMistyTimer.checked = storedState === "true";

    // Update the header text on load based on the saved state.
    const table = document.querySelector("#eventHistoryTab table.event-table") as HTMLTableElement | null;
    if (table && table.tHead && table.tHead.rows.length > 0) {
        const timerHeaderCell = table.tHead.rows[0].cells[3];
        timerHeaderCell.textContent = toggleMistyTimer.checked ? "Misty Timer" : "Time Left";
    }

    toggleMistyTimer.addEventListener("change", (e) => {
        const checkbox = e.target as HTMLInputElement;
        // Save the new state to localStorage
        localStorage.setItem("toggleMistyTimer", checkbox.checked ? "true" : "false");

        const table = document.querySelector("#eventHistoryTab table.event-table") as HTMLTableElement | null;
        if (table && table.tHead && table.tHead.rows.length > 0) {
            // Update the header cell text based on the toggle state.
            const timerHeaderCell = table.tHead.rows[0].cells[3];
            timerHeaderCell.textContent = checkbox.checked ? "Misty Timer" : "Time Left";
        }
    });
}

const toggleNotificationsToday = document.getElementById("toggleNotificationsToday") as HTMLInputElement | null;
let midnightResetTimeoutId: number | null = null;
if (toggleNotificationsToday) {
    const storedState = localStorage.getItem("toggleNotificationsToday") === "true";
    const storedDate = localStorage.getItem("toggleNotificationsTodayDate");
    const todayUTC = new Date().toISOString().slice(0, 10);

    // Reset if stored date is outdated
    if (storedState && storedDate !== todayUTC) {
        localStorage.setItem("toggleNotificationsToday", "false");
        toggleNotificationsToday.checked = false;
    } else {
        toggleNotificationsToday.checked = storedState;
    }

    // If enabled, schedule the reset
    if (toggleNotificationsToday.checked) {
        scheduleNotificationResetAtMidnightUTC();
    }

    toggleNotificationsToday.addEventListener("change", (e) => {
        const checkbox = e.target as HTMLInputElement;
        const checked = checkbox.checked;
        localStorage.setItem("toggleNotificationsToday", checked ? "true" : "false");

        if (checked) {
            localStorage.setItem("toggleNotificationsTodayDate", todayUTC);
            scheduleNotificationResetAtMidnightUTC();
        } else {
            localStorage.removeItem("toggleNotificationsTodayDate");

            // Cancel existing reset timer if any
            if (midnightResetTimeoutId !== null) {
                clearTimeout(midnightResetTimeoutId);
                midnightResetTimeoutId = null;
            }
        }
    });
}

function scheduleNotificationResetAtMidnightUTC(): void {
    const now = new Date();
    const utcNow = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds(),
    );
    const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);

    const msUntilMidnight = utcMidnight - utcNow;

    midnightResetTimeoutId = window.setTimeout(() => {
        localStorage.setItem("toggleNotificationsToday", "false");
        localStorage.removeItem("toggleNotificationsTodayDate");

        if (toggleNotificationsToday) {
            toggleNotificationsToday.checked = false;
        }

        showToast("Notification suppression has reset");

        midnightResetTimeoutId = null;
    }, msUntilMidnight);
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

    modal.style.display = "flex";

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
                mistyUpdate: false,
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
            mistyUpdate: false,
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

    const infoButtonEventHistory = document.getElementById("infoButtonEventHistory") as HTMLElement;
    const modalScouts = document.getElementById("infoModalScouts") as HTMLElement;
    const closeModalScouts = modalScouts.querySelector(".close") as Element;

    // Show the modal when the info button is clicked
    infoButtonEventHistory.addEventListener("click", function () {
        modalScouts.style.display = "flex";
    });

    // Hide the modal when the close button (×) is clicked
    closeModalScouts.addEventListener("click", function () {
        modalScouts.style.display = "none";
    });

    // Hide the modal when clicking outside of the modal content
    window.addEventListener("click", function (event) {
        if (event.target === modalScouts) {
            modalScouts.style.display = "none";
        }
    });

    const infoButtonMistyTimers = document.getElementById("infoButtonMistyTimers") as HTMLElement;
    const modalMisty = document.getElementById("infoModalMisty") as HTMLElement;
    const closeModalMisty = modalMisty.querySelector(".close") as Element;

    // Show the modal when the info button is clicked
    infoButtonMistyTimers.addEventListener("click", function () {
        modalMisty.style.display = "flex";
    });

    // Hide the modal when the close button (×) is clicked
    closeModalMisty.addEventListener("click", function () {
        modalMisty.style.display = "none";
    });

    // Hide the modal when clicking outside of the modal content
    window.addEventListener("click", function (event) {
        if (event.target === modalMisty) {
            modalMisty.style.display = "none";
        }
    });

    const infoButtonNotificationMode = document.getElementById("infoButtonNotificationMode") as HTMLElement;
    const modalNotificationMode = document.getElementById("infoModalNotificationMode") as HTMLElement;
    const closeModalNotificationMode = modalNotificationMode.querySelector(".close") as Element;

    infoButtonNotificationMode.addEventListener("click", function () {
        modalNotificationMode.style.display = "flex";
    });

    closeModalNotificationMode.addEventListener("click", function () {
        modalNotificationMode.style.display = "none";
    });

    window.addEventListener("click", function (event) {
        if (event.target === modalNotificationMode) {
            modalNotificationMode.style.display = "none";
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
    modModal.style.display = "flex";
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

        const token = localStorage.getItem("accessToken");
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
                if (status === 401 && message === "Token has expired") {
                    await refreshToken();
                    await confirmAndDelete();
                } else {
                    return showToast(message, "error");
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
