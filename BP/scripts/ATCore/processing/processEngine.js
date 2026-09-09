// @ts-check
/**
 * Advances one buffered recipe. One paid cycle completes up to process_batch
 * crafts, matching current UtilityCraft machine semantics.
 */
export function advanceProcess(machine, options) {
    const cost = Math.max(1, Number(options.cost) || 1);
    const batch = Math.max(1, Math.floor(options.batch ?? machine.boosts.process_batch ?? 1));
    const maxCrafts = Math.max(0, Math.floor(options.maxCrafts ?? 0));
    const consumptionMultiplier = Math.max(
        Number.EPSILON,
        Number(options.consumptionMultiplier) || 1,
    );
    const consumption =
        Math.max(Number.EPSILON, machine.boosts.consumption ?? 1) * consumptionMultiplier;
    let progress = Math.max(0, Number(options.progress) || 0);

    const maxProgress = Math.ceil(maxCrafts / batch) * cost;
    const progressCapacity = Math.max(0, maxProgress - progress);
    const rate = Math.max(0, machine.rate * Math.max(0, Number(options.rateMultiplier) || 1));
    const energyUsed = Math.min(machine.energy.get(), rate, progressCapacity * consumption);

    if (energyUsed > 0) {
        machine.energy.consume(energyUsed);
        progress += energyUsed / consumption;
    }

    const completedCycles = Math.floor(progress / cost);
    const processCount = Math.min(maxCrafts, completedCycles * batch);
    if (processCount > 0) progress -= Math.ceil(processCount / batch) * cost;

    return { progress: Math.max(0, progress), processCount, energyUsed, cost, batch };
}

/**
 * Advances one shared cycle for the selected input slots. Stack controls the
 * craft count stored in each operation; Multi Processing controls only how
 * many operations are selected.
 */
export function advanceSlotCycle(machine, options) {
    const operations = (options.operations ?? []).filter(Boolean);
    const activeOperations = operations.length;
    const cost = Math.max(1, ...operations.map((operation) => Number(operation.cost) || 1));
    const totalCost = operations.reduce(
        (sum, operation) => sum + Math.max(1, Number(operation.cost) || 1),
        0,
    );
    const energyScale = activeOperations > 0 ? totalCost / cost : 1;
    machine.activeParallelOperations = activeOperations || undefined;
    const result = advanceProcess(machine, {
        progress: options.progress,
        cost,
        batch: 1,
        maxCrafts: activeOperations > 0 ? 1 : 0,
        rateMultiplier: Math.max(0, Number(options.rateMultiplier) || 1) * energyScale,
        consumptionMultiplier: energyScale,
    });
    return {
        ...result,
        activeOperations,
        totalCost,
        completed: result.processCount > 0,
    };
}

/**
 * Charges independent lanes under one shared rate/energy budget and performs
 * exactly one scoreboard energy write. Lane objects are mutated in place.
 *
 * @param {{ energy: { get(): number, consume(amount: number): void }, rate: number, boosts: { consumption?: number, process_batch?: number } }} machine
 * @param {Array<{ batch?: number, cost?: number, maxCrafts?: number, progress?: number, processCount?: number, energyUsed?: number, maxProgress?: number, active?: boolean }>} lanes
 * @param {{ rateMultiplier?: number }} [options]
 */
export function advanceLanes(machine, lanes, options = {}) {
    const consumption = Math.max(Number.EPSILON, machine.boosts.consumption ?? 1);
    const rateMultiplier = Math.max(0, Number(options.rateMultiplier) || 1);
    let activeLanes = 0;

    for (let index = 0; index < lanes.length; index++) {
        const lane = lanes[index];
        lane.batch = Math.max(1, Math.floor(lane.batch ?? machine.boosts.process_batch ?? 1));
        lane.cost = Math.max(1, Number(lane.cost) || 1);
        lane.maxCrafts = Math.max(0, Math.floor(lane.maxCrafts ?? 0));
        lane.progress = Math.max(0, Number(lane.progress) || 0);
        lane.processCount = 0;
        lane.energyUsed = 0;
        lane.maxProgress = Math.ceil(lane.maxCrafts / lane.batch) * lane.cost;
        lane.active = lane.maxCrafts > 0;
        if (lane.active && lane.progress < lane.maxProgress) activeLanes++;
    }

    let energyBudget = Math.min(machine.energy.get(), Math.max(0, machine.rate * rateMultiplier));

    let remainingActive = activeLanes;
    let totalEnergyUsed = 0;
    for (let index = 0; index < lanes.length && energyBudget > 0; index++) {
        const lane = lanes[index];
        if (!lane.active || lane.progress >= lane.maxProgress) continue;
        const fairShare = energyBudget / Math.max(1, remainingActive--);
        const needed = (lane.maxProgress - lane.progress) * consumption;
        lane.energyUsed = Math.min(fairShare, needed);
        lane.progress += lane.energyUsed / consumption;
        energyBudget -= lane.energyUsed;
        totalEnergyUsed += lane.energyUsed;
    }

    if (totalEnergyUsed > 0) machine.energy.consume(totalEnergyUsed);

    for (let index = 0; index < lanes.length; index++) {
        const lane = lanes[index];
        if (!lane.active) continue;
        const completedCycles = Math.floor(lane.progress / lane.cost);
        lane.processCount = Math.min(lane.maxCrafts, completedCycles * lane.batch);
        if (lane.processCount > 0) {
            lane.progress -= Math.ceil(lane.processCount / lane.batch) * lane.cost;
        }
        lane.progress = Math.max(0, lane.progress);
    }

    return totalEnergyUsed;
}
