import { describe, it, expect, beforeEach } from "vitest";

import {
    FALLBACK_REGISTRY,
    applyRegistryPayload,
    getMemberWorlds,
    getRegistry,
    getSpecialWorlds,
    isRegistryPayload,
    resetRegistry,
    WORLD_ACTIVITY_ICONS,
} from "./worldRegistry";

const payload = (overrides: Record<string, unknown> = {}) => ({
    version: 4,
    memberWorlds: ["1", "2", "13", "116", "211", "212"],
    specials: [
        { key: "dsf", label: "DSF world", enabled: true, worlds: ["116"] },
        { key: "leagues", label: "Leagues", enabled: true, worlds: ["13", "211", "212"] },
    ],
    ...overrides,
});

beforeEach(() => {
    resetRegistry();
});

describe("fallback", () => {
    it("starts on the bundled registry", () => {
        expect(getRegistry()).toBe(FALLBACK_REGISTRY);
    });

    it("bundles no league worlds, matching the reverted state", () => {
        expect(getMemberWorlds()).not.toContain("211");
    });

    it("bundles the worlds the client shipped with", () => {
        expect(getMemberWorlds()).toContain("1");
        expect(getMemberWorlds()).toContain("259");
    });

    it("bundles the existing special worlds", () => {
        expect(getSpecialWorlds("116").map((special) => special.key)).toEqual(["dsf"]);
    });
});

describe("applying a payload", () => {
    it("replaces the member worlds", () => {
        applyRegistryPayload(payload());

        expect(getMemberWorlds()).toContain("211");
    });

    it("reports that it applied", () => {
        expect(applyRegistryPayload(payload())).toBe(true);
    });

    it("keeps the previous registry when the payload is malformed", () => {
        applyRegistryPayload(payload());
        const before = getMemberWorlds();

        expect(applyRegistryPayload({ version: 5 } as never)).toBe(false);
        expect(getMemberWorlds()).toEqual(before);
    });

    it("rejects an empty member world list rather than blanking the world dropdown", () => {
        expect(applyRegistryPayload(payload({ memberWorlds: [] }))).toBe(false);
    });

    it("ignores a payload older than the one already applied", () => {
        applyRegistryPayload(payload({ version: 9 }));

        expect(applyRegistryPayload(payload({ version: 8, memberWorlds: ["1", "2", "3"] }))).toBe(false);
        expect(getMemberWorlds()).toContain("211");
    });

    it("applies a payload with the same version, since a repair keeps the number", () => {
        applyRegistryPayload(payload({ version: 9 }));

        expect(applyRegistryPayload(payload({ version: 9, memberWorlds: ["1", "2", "3"] }))).toBe(true);
    });
});

describe("special world lookup", () => {
    it("returns every enabled special containing the world, in payload order", () => {
        applyRegistryPayload(
            payload({
                specials: [
                    { key: "dsf", label: "DSF world", enabled: true, worlds: ["116"] },
                    { key: "leagues", label: "Leagues", enabled: true, worlds: ["116"] },
                ],
            }),
        );

        expect(getSpecialWorlds("116").map((special) => special.key)).toEqual(["dsf", "leagues"]);
    });

    it("skips disabled specials", () => {
        applyRegistryPayload(
            payload({
                specials: [
                    { key: "leagues", label: "Leagues", enabled: false, worlds: ["116"] },
                    { key: "dsf", label: "DSF world", enabled: true, worlds: ["116"] },
                ],
            }),
        );

        expect(getSpecialWorlds("116").map((special) => special.key)).toEqual(["dsf"]);
    });

    it("skips a key with no bundled icon rather than rendering a broken image", () => {
        applyRegistryPayload(
            payload({
                specials: [{ key: "brand_new_thing", label: "New", enabled: true, worlds: ["116"] }],
            }),
        );

        expect(getSpecialWorlds("116")).toEqual([]);
    });

    it("resolves each special to its bundled image", () => {
        applyRegistryPayload(payload());

        expect(getSpecialWorlds("116")[0].imageSrc).toBe(WORLD_ACTIVITY_ICONS.dsf);
    });

    it("returns nothing for a world with no specials", () => {
        applyRegistryPayload(payload());

        expect(getSpecialWorlds("2")).toEqual([]);
    });

    it("ships an icon for leagues so a league season needs no client release", () => {
        expect(WORLD_ACTIVITY_ICONS.leagues).toBeDefined();
    });
});

describe("payload type guard", () => {
    it("accepts a well formed payload", () => {
        expect(isRegistryPayload(payload())).toBe(true);
    });

    it("rejects a websocket message that is not a registry update", () => {
        expect(isRegistryPayload({ type: "addEvent", world: "84" })).toBe(false);
    });

    it("rejects specials that are not shaped like specials", () => {
        expect(isRegistryPayload(payload({ specials: [{ key: "leagues" }] }))).toBe(false);
    });

    it("rejects non-string member worlds", () => {
        expect(isRegistryPayload(payload({ memberWorlds: [1, 2, 3] }))).toBe(false);
    });
});
