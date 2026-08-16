import { v4 as uuid } from "uuid";

/**
 * This client's session id.
 *
 * The server keeps one refresh token per session rather than per user, so two
 * clients signed in to the same Discord account no longer displace each other.
 * That matters because one identity routinely means several clients: an Alt1
 * instance per game client, a desktop and a laptop, or the app and the website.
 * Before this, the newer sign-in silently broke the older client — it lost the
 * Misty tab and stopped earning profile credit for events it still reported.
 *
 * Generated once and kept. Alt1 instances that share storage share this id and
 * therefore share a session, which is the same behaviour as before; instances
 * that do not each get their own. Either way nothing is displaced.
 */
const SESSION_ID_KEY = "sessionId";

export function getSessionId(): string {
    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;

    const created = uuid();
    localStorage.setItem(SESSION_ID_KEY, created);
    return created;
}

/**
 * Forget this client's session id.
 *
 * Only on sign-out, so the next sign-in starts a session the server has no
 * stale record of.
 */
export function clearSessionId(): void {
    localStorage.removeItem(SESSION_ID_KEY);
}
