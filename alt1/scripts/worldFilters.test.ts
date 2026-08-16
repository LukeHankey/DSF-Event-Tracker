import { describe, it, expect } from "vitest";

import { shouldShowWorld, ALL_VISIBLE, WorldFilters } from "./worldFilters";

const filters = (overrides: Partial<WorldFilters> = {}): WorldFilters => ({ ...ALL_VISIBLE, ...overrides });

describe("with everything ticked", () => {
    it("shows an ordinary world", () => {
        expect(shouldShowWorld(84, "Inactive", false)).toBe(true);
    });

    it("shows a league world", () => {
        expect(shouldShowWorld(172, "Inactive", true)).toBe(true);
    });
});

describe("status filters", () => {
    it("hides inactive worlds when asked", () => {
        expect(shouldShowWorld(84, "Inactive", false, filters({ hideInactive: true }))).toBe(false);
    });

    it("hides unknown worlds when asked", () => {
        expect(shouldShowWorld(84, "Unknown", false, filters({ hideUnknown: true }))).toBe(false);
    });

    it("keeps a spawnable world while hiding inactive ones", () => {
        expect(shouldShowWorld(84, "Spawnable", false, filters({ hideInactive: true }))).toBe(true);
    });

    it("hides an inactive league world, status beating the leagues filter", () => {
        expect(shouldShowWorld(172, "Inactive", true, filters({ hideInactive: true }))).toBe(false);
    });
});

describe("range filters", () => {
    it("applies the boundaries inclusively", () => {
        expect(shouldShowWorld(30, "Active", false, filters({ range130: false }))).toBe(false);
        expect(shouldShowWorld(31, "Active", false, filters({ range130: false }))).toBe(true);
        expect(shouldShowWorld(60, "Active", false, filters({ range3060: false }))).toBe(false);
        expect(shouldShowWorld(90, "Active", false, filters({ range6090: false }))).toBe(false);
        expect(shouldShowWorld(91, "Active", false, filters({ range90Plus: false }))).toBe(false);
    });

    it("leaves other ranges alone", () => {
        expect(shouldShowWorld(84, "Active", false, filters({ range130: false }))).toBe(true);
    });
});

describe("leagues against the ranges", () => {
    it("hides league worlds when the leagues filter is off", () => {
        // The reported bug: Leagues unticked, everything else default.
        expect(shouldShowWorld(172, "Inactive", true, filters({ showLeagues: false }))).toBe(false);
    });

    it("keeps league worlds when 90+ is unticked", () => {
        // Every league world is above 90, so the ranges must not apply to them
        // or the two controls fight.
        expect(shouldShowWorld(172, "Active", true, filters({ range90Plus: false }))).toBe(true);
    });

    it("hides an ordinary 90+ world while keeping league worlds", () => {
        const f = filters({ range90Plus: false });

        expect(shouldShowWorld(139, "Active", false, f)).toBe(false);
        expect(shouldShowWorld(172, "Active", true, f)).toBe(true);
    });

    it("shows an ordinary 90+ world while hiding league worlds", () => {
        const f = filters({ showLeagues: false });

        expect(shouldShowWorld(139, "Active", false, f)).toBe(true);
        expect(shouldShowWorld(172, "Active", true, f)).toBe(false);
    });
});
