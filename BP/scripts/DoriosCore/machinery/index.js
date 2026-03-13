// DoriosCore/machinery barrel – re-exports every public symbol from the
// machinery sub-modules so consumers can import from a single path.

export {
    Machine,
    Container,
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
    formatItemName,
    capitalize,
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
