/**
 * Which rows the Misty world filters leave visible.
 *
 * Kept apart from the DOM so the rules can be tested. Two bugs came from them
 * living inside hideWorlds(): league worlds fighting the 90+ range, and a
 * separate guard deciding whether to apply the filters at all, which was never
 * told about the Leagues checkbox.
 */

export interface WorldFilters {
    hideInactive: boolean;
    hideUnknown: boolean;
    range130: boolean;
    range3060: boolean;
    range6090: boolean;
    range90Plus: boolean;
    showLeagues: boolean;
}

export const ALL_VISIBLE: WorldFilters = {
    hideInactive: false,
    hideUnknown: false,
    range130: true,
    range3060: true,
    range6090: true,
    range90Plus: true,
    showLeagues: true,
};

/**
 * Whether a row survives the current filters.
 *
 * `isLeague` is passed in rather than looked up so this stays independent of
 * the registry: the caller knows which worlds belong to the current season.
 *
 * League worlds answer to the Leagues checkbox *instead of* the ranges. Every
 * league world sits above 90, so applying both would mean unticking "90+" hid
 * them even with Leagues ticked, and the two controls would fight.
 */
export const shouldShowWorld = (
    world: number,
    status: string,
    isLeague: boolean,
    filters: WorldFilters = ALL_VISIBLE,
): boolean => {
    if (filters.hideInactive && status === "Inactive") return false;
    if (filters.hideUnknown && status === "Unknown") return false;

    if (isLeague) return filters.showLeagues;

    if (world <= 30) return filters.range130;
    if (world <= 60) return filters.range3060;
    if (world <= 90) return filters.range6090;
    return filters.range90Plus;
};
