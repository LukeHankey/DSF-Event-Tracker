import { describe, it, expect, beforeEach } from "vitest";

import { applyFeaturesPayload, canViewMisty, getFeatures, mistyLockMessage, resetFeatures } from "./clientFeatures";

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
