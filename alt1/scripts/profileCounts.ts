/**
 * Reading the profile tiles back out of the DOM.
 *
 * The Alt1 tiles render a combined figure: "12 (First: 5)" means twelve events
 * of which five were first reports. When a live update arrives before the app
 * has cached the counts — the first update after a page load — the previous
 * values have to come from that text.
 *
 * Taking the leading number alone treated the combined total as the base and
 * then added the firsts on top, so the tile inflated on every such update while
 * the first count reset to zero, because it was read from an element that no
 * longer exists.
 */
export interface Alt1TileCounts {
    base: number;
    first: number;
}

export function parseAlt1Tile(text: string | null): Alt1TileCounts {
    if (!text) return { base: 0, first: 0 };

    const total = Number(/^(\d+)/.exec(text)?.[1] ?? 0);
    const first = Number(/First:\s*(\d+)/.exec(text)?.[1] ?? 0);

    // The rendered total already includes the firsts.
    return { base: Math.max(0, total - first), first };
}
