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
}
