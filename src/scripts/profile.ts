import { decodeJWT } from "./permissions";
import axios from "axios";

let previousEventCounts: UpdateFields = {};

interface UpdateFields {
    "alt1.merchantCount"?: number;
    "alt1.otherCount"?: number;
    count?: number;
    otherCount?: number;
}

export interface ProfileRecord {
    type: "clientProfileUpdate";
    updateFields: UpdateFields;
}

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
 *   "count", "otherCount", "alt1.merchantCount", "alt1.otherCount"
 */
export function updateProfileCounters(updateFields: UpdateFields): void {
    // Get the DOM elements for each counter
    const merchantEl = document.getElementById("merchantEvents");
    const alt1MerchantEl = document.getElementById("alt1Merchant");
    const otherEl = document.getElementById("otherEvents");
    const alt1OtherEl = document.getElementById("alt1Other");
    const totalEl = document.getElementById("totalEvents");

    // Parse current values (or default to 0)
    let merchant = merchantEl ? parseInt(merchantEl.textContent || "0", 10) : 0;
    let alt1Merchant = alt1MerchantEl
        ? parseInt(alt1MerchantEl.textContent || "0", 10)
        : 0;
    let other = otherEl ? parseInt(otherEl.textContent || "0", 10) : 0;
    let alt1Other = alt1OtherEl
        ? parseInt(alt1OtherEl.textContent || "0", 10)
        : 0;

    // Update values if provided in the updateFields payload
    if (updateFields["count"] !== undefined) {
        merchant = updateFields["count"];
        if (merchantEl) {
            merchantEl.textContent = merchant.toString();
        }
    }
    if (updateFields["alt1.merchantCount"] !== undefined) {
        alt1Merchant = updateFields["alt1.merchantCount"];
        if (alt1MerchantEl) {
            alt1MerchantEl.textContent = alt1Merchant.toString();
        }
    }
    if (updateFields["otherCount"] !== undefined) {
        other = updateFields["otherCount"];
        if (otherEl) {
            otherEl.textContent = other.toString();
        }
    }
    if (updateFields["alt1.otherCount"] !== undefined) {
        alt1Other = updateFields["alt1.otherCount"];
        if (alt1OtherEl) {
            alt1OtherEl.textContent = alt1Other.toString();
        }
    }

    // Calculate total events as the sum of all counters
    const total = merchant + alt1Merchant + other + alt1Other;
    if (totalEl) {
        totalEl.textContent = total.toString();
    }

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

    const response = await axios.get(
        `https://api.dsfeventtracker.com/profiles/${discordID}`,
        {
            headers: {
                "Content-Type": "application/json",
            },
        },
    );

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
