/**
 * Helpers for reading the world number out of the friends list header.
 *
 * These are kept out of capture.ts so they can be tested without pulling in
 * alt1's image loaders, which only exist inside a webpack build.
 */

export interface ReadOffset {
    dx: number;
    dy: number;
}

/**
 * Where to start reading, relative to a matched "RuneScape" pretext.
 *
 * The reader cannot get past the "p" of RuneScape - it stops and returns
 * "RuneSca." - so it has to be dropped onto the world number itself while
 * staying on the header line. The first offset is the one measured against
 * every sample capture; the rest widen the search for captures that sit a
 * few pixels off.
 */
export const worldReadOffsets = (): ReadOffset[] => {
    const offsets: ReadOffset[] = [{ dx: 52, dy: 4 }];
    for (let dx = 45; dx <= 80; dx += 3) {
        for (let dy = 2; dy <= 9; dy += 2) {
            if (dx !== 52 || dy !== 4) offsets.push({ dx, dy });
        }
    }
    return offsets;
};

/**
 * Pull the world out of a line the OCR read, e.g. "e 215" -> "215".
 *
 * Returns null rather than throwing when the reader landed somewhere with no
 * digits on it, which is the normal outcome for most offsets.
 */
export const parseWorldNumber = (text: string | null | undefined): string | null => {
    const match = text?.match(/\d{1,3}/);
    return match ? match[0] : null;
};
