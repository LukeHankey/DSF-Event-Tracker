import { decodeJWT } from "./permissions";
import axios from "axios";
import { API_URL } from "../config";

let previousEventCounts: UpdateFields = {};

interface UpdateFields {
    "alt1.merchantCount"?: number;
    "alt1.otherCount"?: number;
    "alt1First.merchantCount"?: number;
    "alt1First.otherCount"?: number;
    count?: number;
    otherCount?: number;
}

export interface ProfileRecord {
    type: "clientProfileUpdate";
    updateFields: UpdateFields;
}

// Store the last known database values to prevent overwriting
const lastKnownCounts: Record<string, number> = {};

/**
 * Updates the profile counters in the UI.
 * Assumes the following element IDs exist in the DOM:
 * - merchantEvents
 * - alt1Merchant
 * - otherEvents
 * - alt1Other
 * - totalEvents
 *
 * @param updateFields An object with optional keys:
 *   "count", "otherCount", "alt1.merchantCount", "alt1.otherCount", "alt1First.merchantCount", "alt1First.otherCount"
 */
export function updateProfileCounters(updateFields: UpdateFields): void {
    // Get the DOM elements for each counter
    const merchantEl = document.getElementById("merchantEvents")!;
    const alt1MerchantEl = document.getElementById("alt1Merchant")!;
    const otherEl = document.getElementById("otherEvents")!;
    const alt1OtherEl = document.getElementById("alt1Other")!;
    const totalEl = document.getElementById("totalEvents")!;

    const alt1MerchantFirstEl = document.getElementById("alt1MerchantFirst")!;
    const alt1OtherFirstEl = document.getElementById("alt1OtherFirst")!;

    // ✅ Extract numerical values safely
    const extractFirstNumber = (text: string | null): number => {
        if (!text) return 0;
        const match = text.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    };

    // ✅ Get previous stored values or initialize them
    let merchant =
        lastKnownCounts["count"] ?? extractFirstNumber(merchantEl?.textContent);
    let alt1Merchant =
        lastKnownCounts["alt1.merchantCount"] ??
        extractFirstNumber(alt1MerchantEl?.textContent);
    let other =
        lastKnownCounts["otherCount"] ??
        extractFirstNumber(otherEl?.textContent);
    let alt1Other =
        lastKnownCounts["alt1.otherCount"] ??
        extractFirstNumber(alt1OtherEl?.textContent);

    let alt1MerchantFirst =
        lastKnownCounts["alt1First.merchantCount"] ??
        extractFirstNumber(alt1MerchantFirstEl?.textContent);
    let alt1OtherFirst =
        lastKnownCounts["alt1First.otherCount"] ??
        extractFirstNumber(alt1OtherFirstEl?.textContent);

    // ✅ Update values correctly (only add the difference)
    if (updateFields["count"] !== undefined) {
        const diff =
            updateFields["count"] - (lastKnownCounts["count"] ?? merchant);
        merchant += diff;
        lastKnownCounts["count"] = updateFields["count"];
        merchantEl.textContent = merchant.toString();
    }
    if (updateFields["alt1.merchantCount"] !== undefined) {
        const diff =
            updateFields["alt1.merchantCount"] -
            (lastKnownCounts["alt1.merchantCount"] ?? alt1Merchant);
        alt1Merchant += diff;
        lastKnownCounts["alt1.merchantCount"] =
            updateFields["alt1.merchantCount"];
    }
    if (updateFields["alt1First.merchantCount"] !== undefined) {
        const diff =
            updateFields["alt1First.merchantCount"] -
            (lastKnownCounts["alt1First.merchantCount"] ?? alt1MerchantFirst);
        alt1MerchantFirst += diff;
        lastKnownCounts["alt1First.merchantCount"] =
            updateFields["alt1First.merchantCount"];
    }

    // ✅ Now Alt1 Merchant includes First Found count
    const totalAlt1Merchant = alt1Merchant + alt1MerchantFirst;
    alt1MerchantEl.textContent = `${totalAlt1Merchant} (First: ${alt1MerchantFirst})`;

    if (updateFields["otherCount"] !== undefined) {
        const diff =
            updateFields["otherCount"] -
            (lastKnownCounts["otherCount"] ?? other);
        other += diff;
        lastKnownCounts["otherCount"] = updateFields["otherCount"];
        otherEl.textContent = other.toString();
    }
    if (updateFields["alt1.otherCount"] !== undefined) {
        const diff =
            updateFields["alt1.otherCount"] -
            (lastKnownCounts["alt1.otherCount"] ?? alt1Other);
        alt1Other += diff;
        lastKnownCounts["alt1.otherCount"] = updateFields["alt1.otherCount"];
    }
    if (updateFields["alt1First.otherCount"] !== undefined) {
        const diff =
            updateFields["alt1First.otherCount"] -
            (lastKnownCounts["alt1First.otherCount"] ?? alt1OtherFirst);
        alt1OtherFirst += diff;
        lastKnownCounts["alt1First.otherCount"] =
            updateFields["alt1First.otherCount"];
    }

    // ✅ Now Alt1 Other includes First Found count
    const totalAlt1Other = alt1Other + alt1OtherFirst;
    alt1OtherEl.textContent = `${totalAlt1Other} (First: ${alt1OtherFirst})`;

    // ✅ Calculate total events correctly (including First Found counts)
    const total = merchant + other + totalAlt1Merchant + totalAlt1Other;
    totalEl.textContent = total.toString();

    // ✅ Update roles based on new event counts
    populateRoles(updateFields);
}

interface BaseRoleData {
    role_id: string;
    role_name: string;
    achievable: boolean;
    require?: string[]; // Optional dependencies
    next_role?: string | null;
}

interface AchievableRole extends BaseRoleData {
    achievable: true; // Forces this type to include these fields
    type_of_event: keyof UpdateFields;
    num_of_event: number;
}

interface NonAchievableRole extends BaseRoleData {
    achievable: false;
    type_of_event?: null;
    num_of_event?: null;
}

// The final type can be either AchievableRole or NonAchievableRole
type RoleData = AchievableRole | NonAchievableRole;

// Define role data structure
// ORDER is important HERE
const ROLE_DATA: RoleData[] = [
    {
        role_id: "443241429440004107",
        role_name: "Staff",
        achievable: false, // No progress tracking
        type_of_event: null,
        num_of_event: null,
    },
    {
        role_id: "444972115180126228",
        role_name: "Moderator",
        achievable: false,
        type_of_event: null,
        num_of_event: null,
    },
    {
        role_id: "445298648188977153",
        role_name: "Administrator",
        achievable: false,
        type_of_event: null,
        num_of_event: null,
    },
    {
        role_id: "626989671729070090",
        role_name: "General",
        achievable: false,
        type_of_event: null,
        num_of_event: null,
    },
    {
        role_id: "775940649802793000",
        role_name: "Scouter",
        achievable: true, // Has a progress bar
        type_of_event: "count",
        num_of_event: 40, // Total required for next milestone
        next_role: "Verified Scouter",
    },
    {
        role_id: "775941183716851764",
        role_name: "Verified Scouter",
        achievable: true,
        type_of_event: "count",
        num_of_event: 100,
        require: ["Scouter"],
        next_role: null,
    },
];

export async function getEventCountData(): Promise<UpdateFields | null> {
    const discordID = localStorage.getItem("discordID");
    if (!discordID) return null;

    const response = await axios.get(`${API_URL}/profiles/${discordID}`, {
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (response.data.count_data) {
        console.log("Received event counts");
        return response.data.count_data;
    } else {
        return null;
    }
}

export function populateRoles(userEventCounts: UpdateFields) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const decodedToken = decodeJWT(token);
    if (!decodedToken || decodedToken.type !== "access") return;

    const roleContainer = document.getElementById("roleBadges")!;
    const progressContainer = document.getElementById("progressRoles")!;

    roleContainer.innerHTML = ""; // Clear existing roles
    progressContainer.innerHTML = ""; // Clear existing progress bars

    userEventCounts = { ...previousEventCounts, ...userEventCounts };
    previousEventCounts = userEventCounts;

    // Track which roles have been achieved
    const achievedRoles = new Set<string>();
    const unlockedRoles = new Set<string>();

    const roleOrder = new Map(
        ROLE_DATA.map((role, index) => [role.role_id, index]),
    );

    // ✅ Sort role_ids based on their position in ROLE_DATA
    const sortedRoleIds = decodedToken.role_ids.sort((a, b) => {
        return (roleOrder.get(a) ?? Infinity) - (roleOrder.get(b) ?? Infinity);
    });

    sortedRoleIds.forEach((roleId) => {
        let role = ROLE_DATA.find((r) => r.role_id === roleId);
        if (!role) return;

        // ✅ Ensure required roles are already achieved before showing this role
        if (
            role.require &&
            !role.require.every((req) => achievedRoles.has(req))
        ) {
            return; // If any required role is missing, skip this role
        }

        let roleAchieved = false;

        // If role has a progress bar, add it
        if (role.achievable) {
            const userEventCount = userEventCounts[role.type_of_event] || 0; // Get user's progress
            const progressPercentage = Math.min(
                (userEventCount / role.num_of_event) * 100,
                100,
            ); // Cap at 100%

            // Create progress bar
            const progressWrapper = document.createElement("div");
            progressWrapper.className = "progress-wrapper";

            progressWrapper.innerHTML = `
                <div class="progress-label">${role.role_name}: ${userEventCount} / ${role.num_of_event}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                </div>
            `;

            // If role is fully achieved, add it to the achievedRoles list
            if (progressPercentage >= 100) {
                roleAchieved = true;
                achievedRoles.add(role.role_name);

                // Unlock the next role
                if (role.next_role) {
                    unlockedRoles.add(role.next_role);
                }
            } else {
                progressContainer.appendChild(progressWrapper);
            }
        } else {
            roleAchieved = true;
        }

        if (roleAchieved) {
            // Create role badge
            const roleBadge = document.createElement("div");
            roleBadge.className = "role-badge";
            roleBadge.innerText = role.role_name;
            roleContainer.appendChild(roleBadge);
        }
    });
}
