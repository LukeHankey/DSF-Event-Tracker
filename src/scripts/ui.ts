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

// Handle settings form submission and save to localStorage
const settingsForm = document.getElementById("settingsForm") as HTMLFormElement | null;
settingsForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (discordIDInput) {
    const discordID = discordIDInput.value;
    localStorage.setItem("discordID", discordID);

    // Show success toast notification
    showToast("✅ Settings saved!");
  }
});
