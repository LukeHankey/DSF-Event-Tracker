import { describe, it, expect, beforeEach, vi } from "vitest";

import { getSessionId, clearSessionId } from "./session";

// A stub rather than jsdom: this module only needs key/value storage, and the
// rest of the suite runs in node.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
});

beforeEach(() => {
    localStorage.clear();
});

describe("session id", () => {
    it("is created on first use", () => {
        expect(getSessionId()).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("is the same on every later call", () => {
        // The server keys a session on this. A new id each time would create a
        // session per refresh and evict the user's real ones.
        expect(getSessionId()).toBe(getSessionId());
    });

    it("survives being read from storage", () => {
        const first = getSessionId();

        expect(localStorage.getItem("sessionId")).toBe(first);
    });

    it("is forgotten on sign out", () => {
        const first = getSessionId();
        clearSessionId();

        expect(localStorage.getItem("sessionId")).toBeNull();
        expect(getSessionId()).not.toBe(first);
    });
});
