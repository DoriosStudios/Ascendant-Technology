import { PROGRESSION_CATEGORIES, PROGRESSION_REASON_CATEGORIES, PROGRESSION_XP_FIELDS } from "../config/definitions.js";
import { ITEM_TYPES } from "../config/equipmentTypes.js";
import { normalizeId } from "../utils.js";

export function getCategoryForReason(reason) {
    const normalized = normalizeId(reason);
    return Object.hasOwn(PROGRESSION_REASON_CATEGORIES, normalized)
        ? PROGRESSION_REASON_CATEGORIES[normalized]
        : null;
}

export function getCategoriesForDefinition(definition) {
    const categories = new Set();
    if (!definition) return categories;

    for (const category of PROGRESSION_CATEGORIES) {
        if (PROGRESSION_XP_FIELDS[category].some(field => definition.progression?.[field] > 0)) {
            categories.add(category);
        }
    }
    if (definition.type === ITEM_TYPES.utility) categories.add("utility");
    return categories;
}
