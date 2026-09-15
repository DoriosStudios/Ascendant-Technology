// @ts-check

import { resourceCost } from "../../ATCore/machinery/upgradeEffects.js";

import { system, world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, FluidStorage } from "DoriosCore/index.js";
import { registerIOInterface } from "../../ATCore/machinery/ioRegistration.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
import {
    applyStationEnchantPlan,
    buildStationEnchantPlan,
    createStationEnchantSignature,
    createStationModuleSignature,
    extractDisenchantments,
    getAbsorbedXp,
    getReinforcementPoints,
    getReinforcementTarget,
    installReinforcementRuntime,
    readDisenchantments,
    removeAllDisenchantments,
    resolveStationModules,
    setReinforcementPoints,
} from "../../ATCore/enchanting/index.js";
import { setDynamicNumber, setDynamicString, setRunning, setUiItem } from "./runtime.js";

const ID = "utilitycraft:enchantment_station";
const GRID_SLOTS = [3, 4, 5, 6, 7, 8, 9, 10, 11];
const MODULE_SLOTS = [12, 13, 14];
const OUTPUT_SLOTS = [22, 23, 24, 25, 26, 27, 28, 29, 30];
const SOURCE_SLOT = 15;
const CATALYST_SLOT = 16;
const BOOK_SLOT = 17;
const DISENCHANT_PROGRESS_SLOT = 18;
const DISENCHANT_STATUS_SLOT = 31;
const XP_DISPLAY_SLOT = 44;
const RESERVED_UI_SLOT = 45;
// Size 45 belongs to an older layout; keep its migration unambiguous.
const INVENTORY_SIZE = 46;
const SLOT_LAYOUTS = {
    44: Array.from({ length: 44 }, (_, index) => index),
    43: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        -1, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
    ],
    45: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        -1, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44,
    ],
};
const BASE_COST = 64_000;
const XP_PER_CHANGE = 1_000;
const REPAIR_AMOUNT = 2_000;
const ABSORB_DELAY_TICKS = 100;
const XP_TYPE = "xp";
const CATALYST_ID = "utilitycraft:refined_aetherium_crystal";
const LANE_PROGRESS_PREFIX = "ascendant:station_progress_";
const LANE_SIGNATURE_PREFIX = "ascendant:station_signature_";
const ABSORB_SIGNATURE_KEY = "ascendant:station_absorb_signature";
const ABSORB_START_KEY = "ascendant:station_absorb_start";

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [32, 33, 34, 35, 36, 37],
        anyInputSlots: [...GRID_SLOTS, ...MODULE_SLOTS, SOURCE_SLOT, CATALYST_SLOT, BOOK_SLOT],
        anyOutputSlots: [...GRID_SLOTS, SOURCE_SLOT, ...OUTPUT_SLOTS],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: GRID_SLOTS },
            { id: "input_2", inputSlots: MODULE_SLOTS },
            { id: "input_3", inputSlots: [SOURCE_SLOT] },
            { id: "input_4", inputSlots: [CATALYST_SLOT] },
            { id: "input_5", inputSlots: [BOOK_SLOT] },
            { id: "input_6", inputSlots: [...GRID_SLOTS, ...MODULE_SLOTS, SOURCE_SLOT, CATALYST_SLOT, BOOK_SLOT] },
            { id: "output_1", outputSlots: GRID_SLOTS },
            { id: "output_2", outputSlots: [SOURCE_SLOT] },
            { id: "output_3", outputSlots: OUTPUT_SLOTS },
            { id: "output_4", outputSlots: [...GRID_SLOTS, SOURCE_SLOT, ...OUTPUT_SLOTS] },
        ],
    },
    liquids: {
        buttonSlots: [38, 39, 40, 41, 42, 43],
        anyInputIndices: [0],
        anyOutputIndices: [0],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
            { id: "output_1", outputIndices: [0] },
            { id: "both", inputIndices: [0], outputIndices: [0] },
        ],
    },
});

/** @type {Map<string, Map<number, { signature: string, plan: import("../../ATCore/enchanting/stationEnchanting.js").StationEnchantPlan }>>} */
const planCache = new Map();

installReinforcementRuntime();

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    planCache.delete(removedEntityId);
});

registerATMachine(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([0, 1, 2, DISENCHANT_PROGRESS_SLOT, DISENCHANT_STATUS_SLOT, XP_DISPLAY_SLOT, RESERVED_UI_SLOT]);
            setUiItem(machine.container, 1, "utilitycraft:ui_filler");
            setUiItem(machine.container, 2, "utilitycraft:arcane_00");
            setUiItem(machine.container, DISENCHANT_PROGRESS_SLOT, "utilitycraft:progress_right_bar_00");
            setUiItem(machine.container, DISENCHANT_STATUS_SLOT, "utilitycraft:ui_filler");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", BASE_COST);
            setDynamicNumber(machine.entity, "dorios:energy_cost_1", BASE_COST);

            const xpTank = new FluidStorage(machine.entity, 0);
            if (xpTank.get() <= 0) xpTank.setType(XP_TYPE);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, SLOT_LAYOUTS)) return;
        if (!machine.container.getItem(XP_DISPLAY_SLOT)) machine.blockSlots([XP_DISPLAY_SLOT]);
        if (!machine.container.getItem(RESERVED_UI_SLOT)) machine.blockSlots([RESERVED_UI_SLOT]);

        machine.processIO();

        const xpTank = new FluidStorage(machine.entity, 0);
        if (xpTank.get() <= 0 && xpTank.getType() !== XP_TYPE) xpTank.setType(XP_TYPE);

        const modules = resolveStationModules(machine.container, MODULE_SLOTS);
        const moduleSignature = createStationModuleSignature(modules);
        const states = [];
        const energyLanes = [];
        let reservedXp = 0;

        for (let index = 0; index < GRID_SLOTS.length; index++) {
            const slot = GRID_SLOTS[index];
            const prepared = prepareMainLane(machine, slot, modules, moduleSignature, xpTank, reservedXp);
            states.push(prepared.state);
            if (!prepared.lane) continue;
            reservedXp += prepared.lane.xpCost;
            energyLanes.push(prepared.lane);
        }

        const disenchant = prepareDisenchant(machine, xpTank);
        if (disenchant.lane) energyLanes.push(disenchant.lane);

        advanceTimedLanes(machine, energyLanes);

        for (let index = 0; index < energyLanes.length; index++) {
            const lane = energyLanes[index];
            if (lane.progress + 0.000001 < lane.cost) continue;

            const committed = lane.commit();
            setLaneProgress(machine, lane.slot, 0);
            lane.progress = 0;
            lane.state.message = committed ? "Updated" : "Operation Failed";
            lane.state.running = committed;
        }

        const absorptionCommitted = disenchant.absorbReady
            ? commitAbsorption(machine, xpTank, disenchant)
            : false;
        if (absorptionCommitted) {
            disenchant.state.message = "Absorbed";
            disenchant.state.running = true;
            disenchant.state.progress = 0;
            resetAbsorption(machine.entity);
        }

        const running = energyLanes.some((lane) => lane.state.running)
            || disenchant.state.running
            || disenchant.state.message === "Absorbing";
        setRunning(machine, running);

        if (machine.shouldUpdateUI) {
            renderStation(machine, xpTank, modules, states, disenchant.state);
        }
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) planCache.delete(entity.id);
        Machine.onDestroy(event);
    },
});

function prepareMainLane(machine, slot, modules, moduleSignature, xpTank, reservedXp) {
    const stack = machine.container.getItem(slot);
    if (!stack) {
        resetLane(machine, slot);
        return { state: mainState(slot, "Empty") };
    }
    if (stack.amount !== 1) {
        resetLane(machine, slot);
        return { state: mainState(slot, "Split Stack") };
    }

    const durability = getDurability(stack);
    const reinforcement = getReinforcementPoints(stack);
    const signature = [
        stack.typeId,
        `d${Math.floor(Number(durability?.damage ?? 0))}`,
        `r${reinforcement}`,
        moduleSignature,
        createStationEnchantSignature(stack),
    ].join("|");

    const cached = getCachedPlan(machine.entity.id, slot);
    let plan = cached?.plan;
    if (!cached || cached.signature !== signature) {
        if (getLaneSignature(machine, slot) !== signature) {
            setLaneSignature(machine, slot, signature);
            setLaneProgress(machine, slot, 0);
        }
        const built = buildStationEnchantPlan(stack, modules);
        plan = built.plan;
        setCachedPlan(machine.entity.id, slot, signature, plan);
        if (built.storedTargetsChanged) machine.container.setItem(slot, stack);
    }

    const repairNeeded = Boolean(durability && durability.damage > 0);
    const reinforcementTarget = durability
        ? getReinforcementTarget(durability, modules.reinforcement)
        : 0;
    const reinforcementNeeded = reinforcementTarget > reinforcement;
    const enchantNeeded = plan.changed;

    if (!repairNeeded && !reinforcementNeeded && !enchantNeeded) {
        setLaneProgress(machine, slot, 0);
        return { state: mainState(slot, "Ready") };
    }

    const xpCost = plan.enchantingChanged
        ? XP_PER_CHANGE * Math.max(1, plan.changeCount)
        : 0;
    if (xpCost > 0 && (xpTank.getType() !== XP_TYPE || xpTank.get() - reservedXp < xpCost)) {
        return { state: { ...mainState(slot, "Need XP", false, getLaneProgress(machine, slot), getMainCost(plan, modules, reinforcementNeeded)), xpCost, changes: plan.changeCount, repairNeeded, reinforcementNeeded } };
    }

    const cost = getMainCost(plan, modules, reinforcementNeeded);
    const seconds = getMainSeconds(plan.changeCount, reinforcementNeeded, repairNeeded);
    const progress = Math.min(cost, getLaneProgress(machine, slot));
    const state = { ...mainState(slot, machine.energy.get() > 0 ? "Processing" : "No Energy", machine.energy.get() > 0, progress, cost), xpCost, changes: plan.changeCount, repairNeeded, reinforcementNeeded };

    return {
        state,
        lane: {
            slot,
            cost,
            seconds,
            progress,
            xpCost,
            state,
            commit: () => commitMainLane(machine, slot, signature, plan, reinforcementTarget, repairNeeded, xpTank, xpCost),
        },
    };
}

function prepareDisenchant(machine, xpTank) {
    const state = disenchantState("Insert Enchanted Item");
    const source = machine.container.getItem(SOURCE_SLOT);
    if (!source) {
        resetLane(machine, SOURCE_SLOT);
        resetAbsorption(machine.entity);
        return { state, absorbReady: false };
    }
    if (source.amount !== 1) {
        resetLane(machine, SOURCE_SLOT);
        resetAbsorption(machine.entity);
        state.message = "Split Stack";
        return { state, absorbReady: false };
    }

    const enchantments = readDisenchantments(source);
    state.enchantments = enchantments.length;
    state.entries = enchantments;
    if (enchantments.length === 0) {
        resetLane(machine, SOURCE_SLOT);
        resetAbsorption(machine.entity);
        state.message = "No Enchantments";
        return { state, absorbReady: false };
    }

    const catalyst = machine.container.getItem(CATALYST_SLOT);
    const books = machine.container.getItem(BOOK_SLOT);
    const extractionMode = catalyst?.typeId === CATALYST_ID
        && books?.typeId === "minecraft:book"
        && catalyst.amount > 0
        && books.amount > 0;

    if (!extractionMode) {
        resetLane(machine, SOURCE_SLOT);
        const xpGain = getAbsorbedXp(enchantments);
        state.mode = "Absorption";
        state.xpGain = xpGain;

        if (xpTank.getType() !== XP_TYPE || (source.typeId !== "minecraft:enchanted_book" && xpTank.getFreeSpace() < xpGain)) {
            resetAbsorption(machine.entity);
            state.message = "XP Tank Full";
            return { state, absorbReady: false };
        }

        const signature = `${source.typeId}|${createDisenchantSignatureFast(enchantments)}`;
        const start = syncAbsorption(machine.entity, signature);
        const elapsed = Math.max(0, system.currentTick - start);
        state.message = "Absorbing";
        state.running = true;
        state.progress = Math.min(ABSORB_DELAY_TICKS, elapsed);
        state.cost = ABSORB_DELAY_TICKS;

        return {
            state,
            absorbReady: elapsed >= ABSORB_DELAY_TICKS,
            source,
            enchantments,
            xpGain,
            signature,
        };
    }

    resetAbsorption(machine.entity);
    const outputSlots = getEmptyOutputSlots(machine);
    const count = Math.min(enchantments.length, catalyst.amount, books.amount, outputSlots.length);
    state.mode = "Extraction";
    state.outputCount = count;
    if (count <= 0) {
        resetLane(machine, SOURCE_SLOT);
        state.message = "No Output Space";
        return { state, absorbReady: false };
    }

    const signature = `${source.typeId}|${createDisenchantSignatureFast(enchantments)}|x${count}`;
    if (getLaneSignature(machine, SOURCE_SLOT) !== signature) {
        setLaneSignature(machine, SOURCE_SLOT, signature);
        setLaneProgress(machine, SOURCE_SLOT, 0);
    }

    const cost = BASE_COST * 10 * count;
    const progress = Math.min(cost, getLaneProgress(machine, SOURCE_SLOT));
    state.message = machine.energy.get() > 0 ? "Extracting" : "No Energy";
    state.running = machine.energy.get() > 0;
    state.progress = progress;
    state.cost = cost;

    return {
        state,
        absorbReady: false,
        lane: {
            slot: SOURCE_SLOT,
            cost,
            seconds: 50 * count,
            progress,
            xpCost: 0,
            state,
            commit: () => commitExtraction(machine, source, enchantments, outputSlots, count),
        },
    };
}

function advanceTimedLanes(machine, lanes) {
    if (lanes.length === 0) return;

    const interval = Math.max(1, Number(machine.processingInterval) || 4);
    const speed = Math.max(0.01, Number(machine.boosts.speed) || 1);
    const consumption = Math.max(0.01, Number(machine.boosts.consumption) || 1);
    const requests = new Array(lanes.length);
    let totalRequested = 0;

    for (let index = 0; index < lanes.length; index++) {
        const lane = lanes[index];
        const progressPerCycle = lane.cost / Math.max(1, lane.seconds * 20) * speed * interval;
        const request = Math.min(
            Math.max(0, lane.cost - lane.progress) * consumption,
            progressPerCycle * consumption,
        );
        requests[index] = request;
        totalRequested += request;
    }

    const available = Math.max(0, machine.energy.get());
    const scale = totalRequested > 0 ? Math.min(1, available / totalRequested) : 0;
    let used = 0;

    for (let index = 0; index < lanes.length; index++) {
        const lane = lanes[index];
        const energy = requests[index] * scale;
        if (energy <= 0) {
            lane.state.running = false;
            continue;
        }

        lane.progress = Math.min(lane.cost, lane.progress + energy / consumption);
        lane.state.progress = lane.progress;
        lane.state.running = true;
        setLaneProgress(machine, lane.slot, lane.progress);
        used += energy;
    }

    if (used > 0) machine.energy.consume(used);
}

function commitMainLane(machine, slot, signature, plan, reinforcementTarget, repairNeeded, xpTank, xpCost) {
    const current = machine.container.getItem(slot);
    if (!current || getLaneSignature(machine, slot) !== signature) return false;
    if (xpCost > 0 && xpTank.get() < xpCost) return false;

    let result = current.clone();
    const durability = getDurability(result);
    if (repairNeeded && !durability) return false;
    if (repairNeeded && durability) durability.damage = Math.max(0, durability.damage - REPAIR_AMOUNT);

    if (plan.changed) {
        const enchanted = applyStationEnchantPlan(result, plan);
        if (!enchanted) return false;
        result = enchanted;
    }

    if (reinforcementTarget > getReinforcementPoints(result)) {
        setReinforcementPoints(result, reinforcementTarget, reinforcementTarget);
    }

    const paidXp = resourceCost(machine, xpCost);
    let consumedXp = 0;
    try {
        machine.container.setItem(slot, result);
        if (xpCost > 0) {
            consumedXp = xpTank.consume(paidXp);
            if (consumedXp !== paidXp) throw new Error("XP commit failed");
        }
        return true;
    } catch {
        if (consumedXp > 0) {
            try {
                xpTank.add(consumedXp);
            } catch {}
        }
        try {
            machine.container.setItem(slot, current);
        } catch {}
        return false;
    }
}

function commitExtraction(machine, source, enchantments, outputSlots, count) {
    const catalyst = machine.container.getItem(CATALYST_SLOT);
    const books = machine.container.getItem(BOOK_SLOT);
    if (catalyst?.typeId !== CATALYST_ID || books?.typeId !== "minecraft:book") return false;
    if (catalyst.amount < count || books.amount < count) return false;
    for (let index = 0; index < count; index++) {
        if (machine.container.getItem(outputSlots[index])) return false;
    }

    const extracted = extractDisenchantments(source, enchantments, count);
    if (!extracted || extracted.books.length !== count) return false;

    try {
        for (let index = 0; index < count; index++) {
            machine.container.setItem(outputSlots[index], extracted.books[index]);
        }
        machine.container.setItem(SOURCE_SLOT, extracted.source);
        setReducedStack(machine, CATALYST_SLOT, catalyst, resourceCost(machine, count, 1));
        setReducedStack(machine, BOOK_SLOT, books, resourceCost(machine, count, 1));
        return true;
    } catch {
        try {
            for (let index = 0; index < count; index++) machine.container.setItem(outputSlots[index], undefined);
            machine.container.setItem(SOURCE_SLOT, source);
            machine.container.setItem(CATALYST_SLOT, catalyst);
            machine.container.setItem(BOOK_SLOT, books);
        } catch {}
        return false;
    }
}

function commitAbsorption(machine, xpTank, prepared) {
    const current = machine.container.getItem(SOURCE_SLOT);
    if (!current || prepared.xpGain <= 0 || xpTank.getType() !== XP_TYPE) return false;
    const storedXp = current.typeId === "minecraft:enchanted_book"
        ? Math.min(prepared.xpGain, Math.max(0, xpTank.getFreeSpace()))
        : prepared.xpGain;
    if (xpTank.getFreeSpace() < storedXp) return false;
    if (`${current.typeId}|${createDisenchantSignatureFast(readDisenchantments(current))}` !== prepared.signature) return false;

    const result = removeAllDisenchantments(current);
    if (!result) return false;

    let addedXp = 0;
    try {
        machine.container.setItem(SOURCE_SLOT, result);
        if (storedXp > 0) addedXp = xpTank.add(storedXp);
        if (addedXp !== storedXp) throw new Error("XP commit failed");
        return true;
    } catch {
        try {
            if (addedXp > 0) xpTank.consume(addedXp);
            machine.container.setItem(SOURCE_SLOT, current);
        } catch {}
        return false;
    }
}

function renderStation(machine, xpTank, modules, states, disenchant) {
    machine.energy.display(0);
    xpTank.display(XP_DISPLAY_SLOT);

    const active = states.filter((state) => state.running);
    const waiting = states.filter((state) => state.message !== "Empty" && !state.running && state.message !== "Ready");
    const representative = active.reduce((best, state) => {
        if (!best) return state;
        return state.progress / Math.max(1, state.cost) > best.progress / Math.max(1, best.cost) ? state : best;
    }, undefined);

    const mainProgress = representative?.progress ?? 0;
    const mainCost = representative?.cost ?? BASE_COST;
    machine.setEnergyCost(mainCost, 0);
    machine.setProgress(mainProgress, { index: 0, slot: 2, display: false });
    machine.displayProgress(mainCost, { index: 0, slot: 2, type: "arcane", scale: 16 });

    machine.setEnergyCost(disenchant.cost || BASE_COST, 1);
    machine.setProgress(disenchant.progress || 0, { index: 1, slot: DISENCHANT_PROGRESS_SLOT, display: false });
    machine.displayProgress(disenchant.cost || BASE_COST, {
        index: 1,
        slot: DISENCHANT_PROGRESS_SLOT,
        type: "progress_right_bar",
        scale: 16,
    });

    const percent = (progress, cost) => `${Math.min(100, Math.floor(100 * progress / Math.max(1, cost)))}%`;
    const energyText = (value) => EnergyStorage.formatEnergyToText(value);
    const section = (title) => `\u00A7r\u00A7e${title}`;
    const line = (title, value) => `\u00A7r\u00A77${title}: \u00A7f${value}`;
    const occupied = states.filter(state => state.message !== "Empty");
    const ready = occupied.filter(state => state.message === "Ready").length;
    const xpDemand = occupied.reduce((sum, state) => sum + (state.xpCost || 0), 0);
    const labels = [
        section("Enchanting & Repair"),
        line("Status", active.length ? "Processing" : waiting.length ? "Waiting" : occupied.length ? "Ready" : "Insert equipment"),
        line("Items / active / ready", `${occupied.length} / ${active.length} / ${ready}`),
        "", section("Modules"),
        line("Enchantability", modules.enchantability),
        line("Reinforcement", modules.reinforcement),
        line("Curse protection", modules.curseProtection),
        "", section("Resources"),
        line("XP", `${Math.floor(xpTank.get())} mB`),
        line("XP required", `${xpDemand} mB`),
        line("Energy", energyText(machine.energy.get())),
        line("Speed", `x${Number(machine.boosts.speed || 1).toFixed(2)}`),
        "", section("Equipment Slots"),
    ];
    if (!occupied.length) labels.push("§r§7One item per slot.", "§r§7Modules improve enchantments", "§r§7and reinforcement.", "§r§7Damaged items are repaired.");
    for (const state of occupied) {
        const progress = state.message === "Processing" ? ` ${percent(state.progress, state.cost)}` : "";
        labels.push(`§r§b${state.slot - GRID_SLOTS[0] + 1}. §f${state.message}${progress}`);
    }
    machine.setLabel(labels, 1);

    const source = machine.container.getItem(SOURCE_SLOT);
    const crystals = machine.container.getItem(CATALYST_SLOT);
    const books = machine.container.getItem(BOOK_SLOT);
    const extraction = disenchant.mode === "Extraction";
    const details = [
        section("Disenchanting"),
        line("Status", source ? disenchant.message : "Insert item"),
        line("Mode", disenchant.mode),
        line("Enchantments", disenchant.enchantments),
        "", section(extraction ? "Book Extraction" : "XP Absorption"),
    ];
    if (extraction) details.push(
        line("Books this cycle", disenchant.outputCount),
        line("Crystals / books", `${crystals?.typeId === CATALYST_ID ? crystals.amount : 0} / ${books?.typeId === "minecraft:book" ? books.amount : 0}`),
        line("Free outputs", `${getEmptyOutputSlots(machine).length}/9`),
        line("Cycle energy", energyText(disenchant.outputCount * BASE_COST * 10 * (machine.boosts.consumption || 1))),
        line("Progress", percent(disenchant.progress, disenchant.cost)),
        "§r§7One crystal + one book", "§r§7per extracted enchantment.",
    );
    else details.push(
        line("XP recovered", `${source?.typeId === "minecraft:enchanted_book" ? Math.min(disenchant.xpGain, Math.max(0, xpTank.getFreeSpace())) : disenchant.xpGain} mB`),
        line("Tank space", `${Math.floor(xpTank.getFreeSpace())} mB`),
        source?.typeId === "minecraft:enchanted_book" ? line("XP discarded", `${Math.max(0, disenchant.xpGain - xpTank.getFreeSpace())} mB`) : line("Time", "5 s"),
        line("Progress", disenchant.mode === "Absorption" ? percent(disenchant.progress, ABSORB_DELAY_TICKS) : "0%"),
        "§r§7Removes enchantments; keeps item.",
        "§r§eFor book extraction:", "§r§7Add refined crystals and books", "§r§7before inserting the item.",
    );
    details.push("", section("Resources"), line("XP", `${Math.floor(xpTank.get())} mB`), line("Energy", energyText(machine.energy.get())));
    if (disenchant.entries.length) {
        details.push("", section("Source Enchantments"));
        for (const entry of disenchant.entries.slice(0, 3)) details.push(`§r§7${entry.id.replace("minecraft:", "").replaceAll("_", " ")} §f${entry.level}`);
        if (disenchant.entries.length > 3) details.push(`§r§7+${disenchant.entries.length - 3} more (see item)`);
    }
    machine.setLabel(details, DISENCHANT_STATUS_SLOT);
}

function getMainCost(plan, modules, reinforcementNeeded) {
    let cost = BASE_COST;
    if (plan.changed && modules.enchantability > 0) {
        cost += BASE_COST * 10 * modules.enchantability;
        cost += 8_000 * 16 * Math.max(1, plan.changeCount);
    }
    if (reinforcementNeeded) cost += BASE_COST * 8 * modules.reinforcement;
    if (plan.changed && modules.curseProtection > 0) cost += BASE_COST * 12 * modules.curseProtection;
    return Math.max(1, Math.floor(cost));
}

function getMainSeconds(changeCount, reinforcementNeeded, repairNeeded) {
    let seconds = 0;
    if (repairNeeded) seconds += 30;
    if (reinforcementNeeded) seconds += 100;
    if (changeCount > 0) seconds += 50 * changeCount;
    return Math.max(3, seconds);
}

function getEmptyOutputSlots(machine) {
    const result = [];
    for (let index = 0; index < OUTPUT_SLOTS.length; index++) {
        const slot = OUTPUT_SLOTS[index];
        if (!machine.container.getItem(slot)) result.push(slot);
    }
    return result;
}

function setReducedStack(machine, slot, stack, amount) {
    if (stack.amount <= amount) machine.container.setItem(slot, undefined);
    else {
        const remaining = stack.clone();
        remaining.amount -= amount;
        machine.container.setItem(slot, remaining);
    }
}

function getCachedPlan(entityId, slot) {
    return planCache.get(entityId)?.get(slot);
}

function setCachedPlan(entityId, slot, signature, plan) {
    let cache = planCache.get(entityId);
    if (!cache) {
        cache = new Map();
        planCache.set(entityId, cache);
    }
    cache.set(slot, { signature, plan });
}

function getLaneProgress(machine, slot) {
    return Math.max(0, Number(machine.entity.getDynamicProperty(`${LANE_PROGRESS_PREFIX}${slot}`)) || 0);
}

function setLaneProgress(machine, slot, value) {
    setDynamicNumber(machine.entity, `${LANE_PROGRESS_PREFIX}${slot}`, value);
}

function getLaneSignature(machine, slot) {
    return String(machine.entity.getDynamicProperty(`${LANE_SIGNATURE_PREFIX}${slot}`) ?? "");
}

function setLaneSignature(machine, slot, value) {
    setDynamicString(machine.entity, `${LANE_SIGNATURE_PREFIX}${slot}`, value);
}

function resetLane(machine, slot) {
    setLaneProgress(machine, slot, 0);
    setLaneSignature(machine, slot, "");
    planCache.get(machine.entity.id)?.delete(slot);
}

function syncAbsorption(entity, signature) {
    if (entity.getDynamicProperty(ABSORB_SIGNATURE_KEY) === signature) {
        const stored = Number(entity.getDynamicProperty(ABSORB_START_KEY));
        if (Number.isFinite(stored) && stored <= system.currentTick) return stored;
    }
    setDynamicString(entity, ABSORB_SIGNATURE_KEY, signature);
    setDynamicNumber(entity, ABSORB_START_KEY, system.currentTick);
    return system.currentTick;
}

function resetAbsorption(entity) {
    setDynamicString(entity, ABSORB_SIGNATURE_KEY, "");
    setDynamicNumber(entity, ABSORB_START_KEY, 0);
}

function createDisenchantSignatureFast(enchantments) {
    let result = "";
    for (let index = 0; index < enchantments.length; index++) {
        const entry = enchantments[index];
        result += `${entry.id}@${entry.level}|`;
    }
    return result;
}

function getDurability(stack) {
    try {
        return /** @type {import("@minecraft/server").ItemDurabilityComponent | undefined} */ (
            stack.getComponent("minecraft:durability") ?? stack.getComponent("durability")
        );
    } catch {
        return undefined;
    }
}

function mainState(slot, message, running = false, progress = 0, cost = BASE_COST) {
    return { slot, message, running, progress, cost };
}

function disenchantState(message) {
    return {
        message,
        mode: "Idle",
        running: false,
        progress: 0,
        cost: BASE_COST,
        enchantments: 0,
        xpGain: 0,
        outputCount: 0,
        entries: [],
    };
}
