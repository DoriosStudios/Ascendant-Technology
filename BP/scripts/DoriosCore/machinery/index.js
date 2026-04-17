// DoriosCore/machinery barrel – re-exports every public symbol from the
// machinery sub-modules so consumers can import from a single path.

export {
    Machine,
    Container,
    getCachedBlockEntity,
    updatePipes,
    applyDynamicRecipeRate,
    buildOverclockLoreLine,
    applyLabelToSlot,
    applyLabels,
    refreshEnergyGeometryAround,
    sanitizeTickSpeed,
    getTickSpeed,
    resolveMachineEnergyRateUnits,
    resolveRecipeTimeSeconds,
} from "./machine.js";

export { Generator } from "./generator.js";

export {
    Energy,
    shareEnergyWithNeighbors,
} from "./energyStorage.js";

export {
    FluidManager,
    GasManager,
    resolveFluidTransferOffset,
    entityAllowsFluid,
    getFluidWhitelist,
    registerFluidContainerDefinition,
    registerFluidContainerDefinitionBatch,
    registerFluidOutputDefinition,
    registerFluidOutputDefinitionBatch,
    registerGasContainerDefinition,
    registerGasContainerDefinitionBatch,
    registerGasOutputDefinition,
    registerGasOutputDefinitionBatch,
} from "./fluidStorage.js";

export {
    tickGate,
    ADAPTIVE_CHECK_RESULT,
    runAdaptiveTickGate,
    resetAdaptiveTickGate,
    findRecipeByInputId,
    formatItemName,
    capitalize,
    formatLoreMetric,
    appendLoreSection,
    formatFluidDisplayName,
    clampChance,
    captureItemMetadata,
    applyItemMetadata,
    extractEnchantments,
    applyEnchantmentsToStack,
    addItemsToSlot,
    feedFluidSlot,
    computeSlotCapacity,
    getOutputCapacity,
    rollByproduct,
    formatSeconds,
    getProgressPerSecond,
    calculateEtaSeconds,
    formatEta,
} from "./helpers.js";

export {
    ButtonItemStack,
    loadButtonItemStack,
    ButtonManager,
    BUTTON_PANEL_DEFAULTS,
    getButtonPanelState,
    getButtonPanelValue,
    setButtonPanelValue,
    pressButtonPanelButton,
    clearButtonPanel,
    renderButtonPanel,
    syncButtonPanel,
} from "../buttons/index.js";
