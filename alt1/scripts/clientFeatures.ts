/**
 * Feature windows the server controls.
 *
 * The Misty tab shows the scouted board and is normally Scouter-only. A
 * moderator can open it to everyone signed in for a period — a double XP
 * weekend, an event — with `/misty open` in Discord. The window arrives with
 * the world registry on startup and over the websocket when it changes.
 *
 * This decides what the UI *shows*. It is not the access control: the server
 * simply does not send world state to connections that are not entitled to it,
 * which is what makes the lock real rather than a blur over data already
 * delivered.
 */

/** The role that can always see the tab, and can edit timers. */
export const SCOUTER_ROLE_ID = "775940649802793000";

export interface MistyPublicWindow {
    open: boolean;
    until: string | null;
    reason: string | null;
}

export interface ClientFeatures {
    mistyPublic: MistyPublicWindow;
}

const CLOSED: ClientFeatures = { mistyPublic: { open: false, until: null, reason: null } };

let currentFeatures: ClientFeatures = CLOSED;

export function getFeatures(): ClientFeatures {
    return currentFeatures;
}

export function resetFeatures(): void {
    currentFeatures = CLOSED;
}

function isFeaturesPayload(data: unknown): data is ClientFeatures {
    if (typeof data !== "object" || data === null) return false;

    const candidate = data as Partial<ClientFeatures>;
    return typeof candidate.mistyPublic === "object" && candidate.mistyPublic !== null;
}

/** Apply a payload from the registry fetch or a websocket update. */
export function applyFeaturesPayload(data: unknown): boolean {
    if (!isFeaturesPayload(data)) return false;

    currentFeatures = { mistyPublic: { ...CLOSED.mistyPublic, ...data.mistyPublic } };
    return true;
}

/**
 * Whether this user should see the Misty tab unlocked.
 *
 * `roleIds` is null when nobody is signed in. The window covers signed-in
 * users only: it widens the audience, it does not remove the need to have
 * linked Discord, and the server enforces the same rule.
 */
export function canViewMisty(roleIds: string[] | null): boolean {
    if (roleIds?.includes(SCOUTER_ROLE_ID)) return true;
    if (!roleIds) return false;

    return currentFeatures.mistyPublic.open;
}

/** What to tell someone who cannot see the tab, so the lock is not a mystery. */
export function mistyLockMessage(roleIds: string[] | null): string {
    const { open, reason } = currentFeatures.mistyPublic;

    if (open && !roleIds) {
        const because = reason ? ` for ${reason}` : "";
        return `Misty is open to everyone${because} — link your Discord account in Settings to see it.`;
    }

    return "Misty world states are available to Scouters. Ask a moderator about becoming one.";
}
