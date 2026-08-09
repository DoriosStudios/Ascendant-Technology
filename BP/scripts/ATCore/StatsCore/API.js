export { ITEM_TYPES, STATSCORE } from "./constants.js";
export {
    getStatsCoreDefinition,
    getStatsCoreRegistrySize,
    getStatsCoreRegistrySnapshot,
    registerStatsCoreDefinition,
    registerStatsCoreDefinitions,
} from "./core/registry.js";
export {
    getEquipment,
    getLiveEquipmentItem,
    persistEquipmentItem,
    setEquipment,
} from "./core/equipment.js";
export {
    readStatsState,
    resetStatsState,
    writeStatsState,
} from "./core/state.js";
export {
    clearStatsCoreLore,
    syncStatsCoreLore,
} from "./core/lore.js";
export {
    collectStatsAbilityEntries,
    collectStatsAbilityNames,
    getStatsAbilitySummary,
    isAdvancedStatsAbilityEffect,
    resolveStatsAbilityName,
} from "./core/abilities.js";
export { resolveStatsAttributes } from "./attributes/resolve.js";
export {
    ARMOR_COMPONENT_ID,
    REGISTER_ARMOR_MITIGATION_EVENT_ID,
    getArmorComponentDefinition,
    registerArmorMitigationDefinition,
    registerArmorMitigationDefinitions,
    resolveArmorComponentMitigation,
} from "./support/armorComponent.js";
export {
    ENTITY_CATEGORIES,
    ENTITY_CATEGORY_MEMBERS,
    ENTITY_TYPE_CATEGORY,
    OFFENSIVE_ENTITY_CATEGORIES,
    effectAppliesToEntity,
    entityMatchesAppliesTo,
    getEntityCategory,
    isTamedEntity,
    normalizeAppliesTo,
    normalizeEntityCategory,
} from "./shared/entityCategories.js";
export {
    getLevelFromXp,
    getProgressAmount,
    getTotalXpForLevel,
    getXpNeededForLevel,
    grantStatsProgress,
} from "./progression/refinement.js";
export {
    REFINEMENT_ABILITY_CATALOG,
    REFINEMENT_ABILITY_KEYS,
    REFINEMENT_ATTRIBUTE_CATALOG,
    REFINEMENT_ATTRIBUTE_KEYS,
    getRefinementAbilityOption,
    getRefinementAttributeOption,
} from "./refining/commandCatalog.js";
export {
    initializeStatsCoreRuntime,
    isStatsCoreEnabled,
    setStatsCoreEnabled,
} from "./runtime.js";

