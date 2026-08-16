import { describe, it, expect, beforeEach } from "vitest";

import {
    applyFeaturesPayload,
    canViewMisty,
    formatCountdown,
    getFeatures,
    mistyLockMessage,
    mistyWindowRemainingMs,
    resetFeatures,
} from "./clientFeatures";

beforeEach(() => {
    resetFeatures();
});

const SCOUTER = "775940649802793000";

describe("defaults", () => {
    it("starts closed", () => {
        expect(getFeatures().mistyPublic.open).toBe(false);
    });

    it("keeps a scouter able to view", () => {
        expect(canViewMisty([SCOUTER])).toBe(true);
    });

    it("keeps a signed-in non-scouter locked out", () => {
        expect(canViewMisty(["another-role"])).toBe(false);
    });
});

describe("an open window", () => {
    it("lets a signed-in non-scouter view", () => {
        applyFeaturesPayload({ mistyPublic: { open: true, until: null, reason: null } });

        expect(canViewMisty(["another-role"])).toBe(true);
    });

    it("still locks out someone with no roles at all, who is not signed in", () => {
        applyFeaturesPayload({ mistyPublic: { open: true, until: null, reason: null } });

        expect(canViewMisty(null)).toBe(false);
    });

    it("is applied from a websocket payload", () => {
        expect(applyFeaturesPayload({ mistyPublic: { open: true, until: null, reason: "DXP" } })).toBe(true);
        expect(getFeatures().mistyPublic.reason).toBe("DXP");
    });

    it("ignores a payload that is not about features", () => {
        expect(applyFeaturesPayload({ type: "addEvent", world: "84" })).toBe(false);
    });
});

describe("lock message", () => {
    it("tells a guest to link Discord when the window is open", () => {
        applyFeaturesPayload({ mistyPublic: { open: true, until: null, reason: "DXP" } });

        expect(mistyLockMessage(null)).toMatch(/link/i);
    });

    it("mentions the reason when one is set", () => {
        applyFeaturesPayload({ mistyPublic: { open: true, until: null, reason: "Double XP" } });

        expect(mistyLockMessage(null)).toMatch(/Double XP/);
    });

    it("tells a signed-in user they need the Scouter role when closed", () => {
        expect(mistyLockMessage(["another-role"])).toMatch(/scouter/i);
    });
});

describe("window expiry", () => {
    it("treats a window whose end has passed as closed", () => {
        applyFeaturesPayload({
            mistyPublic: { open: true, until: new Date(Date.now() - 1000).toISOString(), reason: null },
        });

        expect(canViewMisty(["another-role"])).toBe(false);
    });

    it("keeps a window with time left open", () => {
        applyFeaturesPayload({
            mistyPublic: { open: true, until: new Date(Date.now() + 60_000).toISOString(), reason: null },
        });

        expect(canViewMisty(["another-role"])).toBe(true);
    });

    it("keeps an open-ended window open", () => {
        applyFeaturesPayload({ mistyPublic: { open: true, until: null, reason: null } });

        expect(canViewMisty(["another-role"])).toBe(true);
    });
});

describe("countdown", () => {
    it("reports the milliseconds left", () => {
        applyFeaturesPayload({
            mistyPublic: { open: true, until: new Date(Date.now() + 90_000).toISOString(), reason: null },
        });

        expect(mistyWindowRemainingMs()).toBeGreaterThan(88_000);
        expect(mistyWindowRemainingMs()).toBeLessThanOrEqual(90_000);
    });

    it("reports null for an open-ended window, which has nothing to count down", () => {
        applyFeaturesPayload({ mistyPublic: { open: true, until: null, reason: null } });

        expect(mistyWindowRemainingMs()).toBeNull();
    });

    it("never reports a negative remainder", () => {
        applyFeaturesPayload({
            mistyPublic: { open: true, until: new Date(Date.now() - 60_000).toISOString(), reason: null },
        });

        expect(mistyWindowRemainingMs()).toBe(0);
    });

    it("formats seconds", () => {
        expect(formatCountdown(43_000)).toBe("43s");
    });

    it("formats minutes and seconds", () => {
        expect(formatCountdown(9 * 60_000 + 43_000)).toBe("9m 43s");
    });

    it("formats hours and minutes, dropping seconds", () => {
        expect(formatCountdown(3 * 3_600_000 + 12 * 60_000 + 5_000)).toBe("3h 12m");
    });

    it("formats days and hours for a long window", () => {
        expect(formatCountdown(2 * 86_400_000 + 3 * 3_600_000)).toBe("2d 3h");
    });

    it("formats zero", () => {
        expect(formatCountdown(0)).toBe("0s");
    });
});
