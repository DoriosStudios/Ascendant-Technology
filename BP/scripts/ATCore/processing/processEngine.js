// @ts-check

/**
 * Advances one buffered recipe. One paid cycle completes up to process_batch
 * crafts, matching current UtilityCraft machine semantics.
 */
export function advanceProcess(machine, options) {
    const cost = Math.max(1, Number(options.cost) || 1);
    const batch = Math.max(1, Math.floor(options.batch ?? machine.boosts.process_batch ?? 1));
    const maxCrafts = Math.max(0, Math.floor(options.maxCrafts ?? 0));
    const consumption = Math.max(Number.EPSILON, machine.boosts.consumption ?? 1);
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
 * Charges independent lanes under one shared rate/energy budget and performs
 * exactly one scoreboard energy write. Lane objects are mutated in place.
 */
export function advanceLanes(machine, lanes) {
    const consumption = Math.max(Number.EPSILON, machine.boosts.consumption ?? 1);
    let energyBudget = Math.min(machine.energy.get(), Math.max(0, machine.rate));
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
        if (lane.maxCrafts > 0 && lane.progress < lane.maxProgress) activeLanes++;
    }

    let remainingActive = activeLanes;
    let totalEnergyUsed = 0;
    for (let index = 0; index < lanes.length && energyBudget > 0; index++) {
        const lane = lanes[index];
        if (lane.maxCrafts <= 0 || lane.progress >= lane.maxProgress) continue;
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
        const completedCycles = Math.floor(lane.progress / lane.cost);
        lane.processCount = Math.min(lane.maxCrafts, completedCycles * lane.batch);
        if (lane.processCount > 0) {
            lane.progress -= Math.ceil(lane.processCount / lane.batch) * lane.cost;
        }
        lane.progress = Math.max(0, lane.progress);
    }

    return totalEnergyUsed;
}
