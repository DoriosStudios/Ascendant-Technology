import { REFINEMENT_ATTRIBUTE_CATALOG, REFINEMENT_ABILITY_CATALOG } from "../config/refinement.js";
export { REFINEMENT_ATTRIBUTE_CATALOG, REFINEMENT_ABILITY_CATALOG, REFINEMENT_ATTRIBUTE_KEYS, REFINEMENT_ABILITY_KEYS } from "../config/refinement.js";

export function getRefinementAttributeOption(value) {
    return REFINEMENT_ATTRIBUTE_CATALOG[String(value ?? "").trim().toLowerCase()] ?? null;
}

export function getRefinementAbilityOption(value) {
    return REFINEMENT_ABILITY_CATALOG[String(value ?? "").trim().toLowerCase()] ?? null;
}
