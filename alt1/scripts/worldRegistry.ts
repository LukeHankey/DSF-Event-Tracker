/**
 * World registry: the world configuration this client renders.
 *
 * The member world list and the special-world icons used to be hardcoded here
 * and in two other repositories, which is how they drifted apart. They now come
 * from the server (`GET /worlds/registry`), which serves a document the Discord
 * bot edits, so a league season can be switched on without a client release.
 *
 * The lists below are the bundled fallback: the client renders these until the
 * first payload arrives, and keeps them if the server is unreachable. A payload
 * that fails validation is discarded rather than half-applied — an empty member
 * world list would blank the world dropdown and the misty timers table.
 */

import axios from "axios";

import { API_URL } from "../config";
import { applyFeaturesPayload } from "./clientFeatures";

/** Icons this build ships. A registry key with no entry here renders no icon. */
export const WORLD_ACTIVITY_ICONS: Record<string, string> = {
    legacy: "./assets/world_activity/legacy.png",
    vip: "./assets/world_activity/vip_badge.png",
    quick_chat: "./assets/world_activity/quick_chat.png",
    eoc: "./assets/world_activity/revolution.png",
    fifteen_plus: "./assets/world_activity/1500.png",
    twenty_plus: "./assets/world_activity/2000.png",
    twenty_six_plus: "./assets/world_activity/2600.png",
    laggy: "./assets/world_activity/lag.png",
    dsf: "./assets/world_activity/dsf.png",
    sixty_nine: "./assets/world_activity/nice.png",
    leagues: "./assets/world_activity/leagues.png",
};

export interface SpecialWorldGroup {
    key: string;
    label: string;
    enabled: boolean;
    worlds: string[];
}

export interface WorldRegistryPayload {
    version: number;
    memberWorlds: string[];
    specials: SpecialWorldGroup[];
}

/** A special world resolved to something renderable. */
export interface SpecialWorld {
    key: string;
    label: string;
    imageSrc: string;
}

const FALLBACK_MEMBER_WORLDS: string[] = [
    "1",
    "2",
    "4",
    "5",
    "6",
    "9",
    "10",
    "12",
    "14",
    "15",
    "16",
    "18",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "30",
    "31",
    "32",
    "35",
    "36",
    "37",
    "39",
    "40",
    "42",
    "44",
    "45",
    "46",
    "48",
    "49",
    "50",
    "51",
    "52",
    "53",
    "54",
    "56",
    "58",
    "59",
    "60",
    "62",
    "63",
    "64",
    "65",
    "66",
    "67",
    "68",
    "69",
    "70",
    "71",
    "72",
    "73",
    "74",
    "76",
    "77",
    "78",
    "79",
    "82",
    "83",
    "84",
    "85",
    "86",
    "87",
    "88",
    "89",
    "91",
    "92",
    "96",
    "97",
    "98",
    "99",
    "100",
    "103",
    "104",
    "105",
    "106",
    "114",
    "115",
    "116",
    "117",
    "119",
    "123",
    "124",
    "134",
    "137",
    "138",
    "139",
    "140",
    "252",
    "257",
    "258",
    "259",
];

const FALLBACK_SPECIALS: SpecialWorldGroup[] = [
    { key: "legacy", label: "Legacy", enabled: true, worlds: ["18", "115", "137"] },
    { key: "twenty_plus", label: "2000+ total", enabled: true, worlds: ["30"] },
    { key: "twenty_six_plus", label: "2600+ total", enabled: true, worlds: ["48"] },
    { key: "vip", label: "VIP", enabled: true, worlds: ["52"] },
    { key: "eoc", label: "EoC", enabled: true, worlds: ["66"] },
    { key: "laggy", label: "Laggy", enabled: true, worlds: ["84"] },
    { key: "fifteen_plus", label: "1500+ total", enabled: true, worlds: ["86", "114"] },
    { key: "quick_chat", label: "Quick chat", enabled: true, worlds: ["96"] },
    { key: "dsf", label: "DSF world", enabled: true, worlds: ["116"] },
    { key: "sixty_nine", label: "Nice", enabled: true, worlds: ["69"] },
];

/** Version 0 marks "this did not come from the server". */
export const FALLBACK_REGISTRY: WorldRegistryPayload = {
    version: 0,
    memberWorlds: FALLBACK_MEMBER_WORLDS,
    specials: FALLBACK_SPECIALS,
};

let currentRegistry: WorldRegistryPayload = FALLBACK_REGISTRY;

export function getRegistry(): WorldRegistryPayload {
    return currentRegistry;
}

export function resetRegistry(): void {
    currentRegistry = FALLBACK_REGISTRY;
}

/** Every world the client offers and polls, as strings. */
export function getMemberWorlds(): string[] {
    return currentRegistry.memberWorlds;
}

/**
 * The icons a world should show, in registry order.
 *
 * A world can belong to several enabled groups — leagues on the DSF world, say
 * — so this returns a list. Keys without a bundled icon are dropped rather than
 * rendered as a broken image.
 */
export function getSpecialWorlds(world: string): SpecialWorld[] {
    return currentRegistry.specials
        .filter((special) => special.enabled && special.worlds.includes(world))
        .filter((special) => WORLD_ACTIVITY_ICONS[special.key])
        .map((special) => ({
            key: special.key,
            label: special.label,
            imageSrc: WORLD_ACTIVITY_ICONS[special.key],
        }));
}

/** Narrow an unknown message — an HTTP body or a websocket frame — to a payload. */
export function isRegistryPayload(data: unknown): data is WorldRegistryPayload {
    if (typeof data !== "object" || data === null) return false;

    const candidate = data as Partial<WorldRegistryPayload>;
    if (typeof candidate.version !== "number") return false;
    if (!Array.isArray(candidate.memberWorlds) || !Array.isArray(candidate.specials)) return false;
    if (!candidate.memberWorlds.every((world) => typeof world === "string")) return false;

    return candidate.specials.every(
        (special) =>
            typeof special === "object" &&
            special !== null &&
            typeof special.key === "string" &&
            typeof special.label === "string" &&
            typeof special.enabled === "boolean" &&
            Array.isArray(special.worlds) &&
            special.worlds.every((world) => typeof world === "string"),
    );
}

/**
 * Validate and apply a payload. Returns whether the live registry changed.
 *
 * Older versions are ignored so a late websocket frame cannot undo a newer
 * fetch; an equal version is applied, because a corrected document keeps its
 * number when it is rewritten.
 */
export function applyRegistryPayload(data: unknown): boolean {
    if (!isRegistryPayload(data)) {
        console.error("Discarded malformed world registry payload:", data);
        return false;
    }

    if (!data.memberWorlds.length) {
        console.error("Discarded world registry with no member worlds");
        return false;
    }

    if (data.version < currentRegistry.version) return false;

    currentRegistry = data;
    console.log(`World registry v${data.version} applied: ${data.memberWorlds.length} member worlds`);
    return true;
}

/**
 * Fetch the registry from the server, once, at startup.
 *
 * Never throws: a client that cannot reach the server still works on the
 * bundled fallback, and live updates arrive over the websocket afterwards.
 */
export async function fetchRegistry(): Promise<void> {
    try {
        const response = await axios.get(`${API_URL}/worlds/registry`);
        applyRegistryPayload(response.data);
        // The same document carries the feature windows, so one fetch does both.
        applyFeaturesPayload(response.data);
    } catch (error) {
        console.error("Could not fetch the world registry, using bundled worlds:", error);
    }
}
