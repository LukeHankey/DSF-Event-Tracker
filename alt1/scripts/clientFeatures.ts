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

    return isWindowOpen();
}

/**
 * Whether the window is open *now*.
 *
 * The server computes `open` when it sends the payload, so a client holding a
 * payload from earlier would stay unlocked past the end time until something
 * else arrived. Checking `until` here means the window closes itself on the
 * client too.
 */
function isWindowOpen(): boolean {
    const { open, until } = currentFeatures.mistyPublic;
    if (!open) return false;
    if (!until) return true;

    return new Date(until).getTime() > Date.now();
}

/** Milliseconds left in the window, or null when it has no end. */
export function mistyWindowRemainingMs(): number | null {
    const { until } = currentFeatures.mistyPublic;
    if (!until) return null;

    return Math.max(0, new Date(until).getTime() - Date.now());
}

/**
 * A countdown that stays short at every scale: "2d 3h", "3h 12m", "9m 43s".
 *
 * Seconds only matter when the end is close, so they are dropped above an
 * hour where they would just be noise in a banner.
 */
export function formatCountdown(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
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
