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
    hideLeagues: boolean;
    hideLegacy: boolean;
    range130: boolean;
    range3060: boolean;
    range6090: boolean;
    range90Plus: boolean;
}

export const ALL_VISIBLE: WorldFilters = {
    hideInactive: false,
    hideUnknown: false,
    hideLeagues: false,
    hideLegacy: false,
    range130: true,
    range3060: true,
    range6090: true,
    range90Plus: true,
};

/** Which special groups a world belongs to, as far as the filters care. */
export interface WorldGroups {
    isLeague: boolean;
    isLegacy: boolean;
}

/**
 * Whether a row survives the current filters.
 *
 * Group membership is passed in rather than looked up so this stays
 * independent of the registry: the caller knows which worlds are in which
 * group this season.
 *
 * The "Hide X" filters are subtractive and all read the same way — ticked
 * removes those rows — which is why Leagues reads as "Hide Leagues" alongside
 * "Hide Inactive" and "Hide Unknown" rather than as a range.
 *
 * League worlds still bypass the *ranges*. Every league world sits above 90,
 * so unticking "90+" would otherwise hide them all and the two controls would
 * fight. Legacy worlds are scattered across the ranges and get no such
 * exemption.
 */
export const shouldShowWorld = (
    world: number,
    status: string,
    groups: WorldGroups,
    filters: WorldFilters = ALL_VISIBLE,
): boolean => {
    if (filters.hideInactive && status === "Inactive") return false;
    if (filters.hideUnknown && status === "Unknown") return false;

    if (groups.isLeague && filters.hideLeagues) return false;
    if (groups.isLegacy && filters.hideLegacy) return false;

    if (groups.isLeague) return true;

    if (world <= 30) return filters.range130;
    if (world <= 60) return filters.range3060;
    if (world <= 90) return filters.range6090;
    return filters.range90Plus;
};
