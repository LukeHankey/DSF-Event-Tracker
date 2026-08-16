import { describe, it, expect } from "vitest";

import { shouldShowWorld, ALL_VISIBLE, WorldFilters, WorldGroups } from "./worldFilters";

const filters = (overrides: Partial<WorldFilters> = {}): WorldFilters => ({ ...ALL_VISIBLE, ...overrides });
const groups = (overrides: Partial<WorldGroups> = {}): WorldGroups => ({
    isLeague: false,
    isLegacy: false,
    ...overrides,
});

describe("with nothing filtered", () => {
    it("shows an ordinary world", () => {
        expect(shouldShowWorld(84, "Inactive", groups())).toBe(true);
    });

    it("shows a league world", () => {
        expect(shouldShowWorld(172, "Inactive", groups({ isLeague: true }))).toBe(true);
    });

    it("shows a legacy world", () => {
        expect(shouldShowWorld(18, "Inactive", groups({ isLegacy: true }))).toBe(true);
    });
});

describe("status filters", () => {
    it("hides inactive worlds when asked", () => {
        expect(shouldShowWorld(84, "Inactive", groups(), filters({ hideInactive: true }))).toBe(false);
    });

    it("hides unknown worlds when asked", () => {
        expect(shouldShowWorld(84, "Unknown", groups(), filters({ hideUnknown: true }))).toBe(false);
    });

    it("keeps a spawnable world while hiding inactive ones", () => {
        expect(shouldShowWorld(84, "Spawnable", groups(), filters({ hideInactive: true }))).toBe(true);
    });

    it("hides an inactive league world, status beating the group filters", () => {
        expect(shouldShowWorld(172, "Inactive", groups({ isLeague: true }), filters({ hideInactive: true }))).toBe(
            false,
        );
    });
});

describe("range filters", () => {
    it("applies the boundaries inclusively", () => {
        expect(shouldShowWorld(30, "Active", groups(), filters({ range130: false }))).toBe(false);
        expect(shouldShowWorld(31, "Active", groups(), filters({ range130: false }))).toBe(true);
        expect(shouldShowWorld(60, "Active", groups(), filters({ range3060: false }))).toBe(false);
        expect(shouldShowWorld(90, "Active", groups(), filters({ range6090: false }))).toBe(false);
        expect(shouldShowWorld(91, "Active", groups(), filters({ range90Plus: false }))).toBe(false);
    });

    it("leaves other ranges alone", () => {
        expect(shouldShowWorld(84, "Active", groups(), filters({ range130: false }))).toBe(true);
    });
});

describe("hide leagues", () => {
    it("hides league worlds when ticked", () => {
        expect(shouldShowWorld(172, "Inactive", groups({ isLeague: true }), filters({ hideLeagues: true }))).toBe(
            false,
        );
    });

    it("keeps league worlds when 90+ is unticked", () => {
        // Every league world is above 90, so the ranges must not apply to them
        // or the two controls fight.
        expect(shouldShowWorld(172, "Active", groups({ isLeague: true }), filters({ range90Plus: false }))).toBe(true);
    });

    it("hides an ordinary 90+ world while keeping league worlds", () => {
        const f = filters({ range90Plus: false });

        expect(shouldShowWorld(139, "Active", groups(), f)).toBe(false);
        expect(shouldShowWorld(172, "Active", groups({ isLeague: true }), f)).toBe(true);
    });

    it("keeps ordinary 90+ worlds while hiding league worlds", () => {
        const f = filters({ hideLeagues: true });

        expect(shouldShowWorld(139, "Active", groups(), f)).toBe(true);
        expect(shouldShowWorld(172, "Active", groups({ isLeague: true }), f)).toBe(false);
    });
});

describe("hide legacy", () => {
    it("hides legacy worlds when ticked", () => {
        expect(shouldShowWorld(18, "Active", groups({ isLegacy: true }), filters({ hideLegacy: true }))).toBe(false);
    });

    it("leaves other worlds in the same range alone", () => {
        const f = filters({ hideLegacy: true });

        expect(shouldShowWorld(18, "Active", groups({ isLegacy: true }), f)).toBe(false);
        expect(shouldShowWorld(19, "Active", groups(), f)).toBe(true);
    });

    it("still applies the ranges to legacy worlds, unlike leagues", () => {
        // Legacy worlds are spread across every range, so they get no exemption:
        // unticking their range hides them like anything else.
        expect(shouldShowWorld(18, "Active", groups({ isLegacy: true }), filters({ range130: false }))).toBe(false);
    });

    it("hides a world that is both legacy and league when either is ticked", () => {
        const both = groups({ isLeague: true, isLegacy: true });

        expect(shouldShowWorld(172, "Active", both, filters({ hideLeagues: true }))).toBe(false);
        expect(shouldShowWorld(172, "Active", both, filters({ hideLegacy: true }))).toBe(false);
        expect(shouldShowWorld(172, "Active", both, filters())).toBe(true);
    });
});
