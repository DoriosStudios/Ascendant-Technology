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
    collectStatsAbilityNames,
    resolveStatsAbilityName,
} from "./core/abilities.js";
export { resolveStatsAttributes } from "./attributes/resolve.js";
export {
    getLevelFromXp,
    getProgressAmount,
    getXpNeededForLevel,
    grantStatsProgress,
} from "./progression/refinement.js";
