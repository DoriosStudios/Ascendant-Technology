import { system, world, ItemStack, BlockPermutation } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { Energy, shareEnergyWithNeighbors } from "./energyStorage.js";
import { FluidManager, GasManager, resolveFluidTransferOffset, entityAllowsFluid } from "./fluidStorage.js";
import { Rotation } from "../utils/rotation.js";
import {
    ENERGY_DEBUG_PROP,
    ENERGY_GEOMETRY_TAG,
    ENERGY_GEOMETRY_SKIP_TYPES,
    DEFAULT_TICK_SPEED,
    TICKS_PER_SECOND,
    LABEL_CHAR_LIMIT,
    LABEL_PLACEHOLDER_ITEM,
    HIDDEN_SLOT_FILLER_ITEM,
    CARDINAL_DIRECTION_OFFSETS,
    OPPOSITE_DIRECTIONS,
} from "../constants.js";

// ─── Energy geometry helpers ─────────────────────────────────────────────────

function energyDebugEnabled() {
    try {
        const value = world.getDynamicProperty(ENERGY_DEBUG_PROP);
        if (value !== undefined) return value === true;
    } catch { /* ignore dynamic property errors */ }
    return globalThis.energyDebugEnabled === true;
}

function formatBlockPos(pos) {
    if (!pos) return "?";
    return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
}

function logEnergyDebug(message, details) {
    if (!energyDebugEnabled()) return;
    const suffix = details
        ? ` ${typeof details === "string" ? details : JSON.stringify(details)}`
        : "";
    console.warn(`[EnergyDebug] ${message}${suffix}`);
}

function shouldSkipEnergyGeometry(block) {
    if (!block) return true;
    if (ENERGY_GEOMETRY_SKIP_TYPES.has(block.typeId)) return true;
    if (block.hasTag?.("dorios:overclock_network")) return true;
    return false;
}

function updateEnergyGeometry(block) {
    if (!block?.permutation || !block?.dimension) return;
    if (shouldSkipEnergyGeometry(block)) return;
    if (!block.hasTag?.("dorios:isTube")) return;

    const dim = block.dimension;
    const { x, y, z } = block.location;

    const neighbors = {
        up: dim.getBlock({ x, y: y + 1, z }),
        down: dim.getBlock({ x, y: y - 1, z }),
        north: dim.getBlock({ x, y, z: z - 1 }),
        south: dim.getBlock({ x, y, z: z + 1 }),
        east: dim.getBlock({ x: x + 1, y, z }),
        west: dim.getBlock({ x: x - 1, y, z })
    };

    const colorTags = (block.getTags?.() ?? []).filter(tag => tag.startsWith("dorios:color."));

    for (const [dir, neighbor] of Object.entries(neighbors)) {
        let shouldConnect = false;

        if (neighbor?.hasTag?.(ENERGY_GEOMETRY_TAG)) {
            const isNeighborPipe = neighbor.hasTag?.("dorios:isTube");

            if (!isNeighborPipe) {
                shouldConnect = true;
            } else {
                for (const tag of colorTags) {
                    if (neighbor.hasTag?.(tag)) {
                        shouldConnect = true;
                        break;
                    }
                }
            }
        }

        if (block.getState(`utilitycraft:${dir}`) !== shouldConnect) {
            block.setState(`utilitycraft:${dir}`, shouldConnect);
        }
    }
}

export function refreshEnergyGeometryAround(block) {
    if (!block?.dimension) return;
    const dim = block.dimension;
    const { x, y, z } = block.location;
    const targets = [
        block,
        dim.getBlock({ x, y: y + 1, z }),
        dim.getBlock({ x, y: y - 1, z }),
        dim.getBlock({ x, y, z: z - 1 }),
        dim.getBlock({ x, y, z: z + 1 }),
        dim.getBlock({ x: x - 1, y, z }),
        dim.getBlock({ x: x + 1, y, z })
    ];

    for (const target of targets) {
        if (!target?.hasTag?.(ENERGY_GEOMETRY_TAG)) continue;
        updateEnergyGeometry(target);
    }
}

/**
 * Updates pipe network connections for energy or fluid systems.
 *
 * @param {Block} block The block that was placed or modified.
 * @param {'energy'|'fluid'|'gas'} type The type of pipe network to update.
 */
export function updatePipes(block, type) {
    const normalizedType = type === 'gas' ? 'fluid' : type;
    if (!block || (normalizedType !== 'energy' && normalizedType !== 'fluid')) return;

    if (normalizedType === 'energy') {
        logEnergyDebug("updatePipes", {
            block: block.typeId,
            pos: formatBlockPos(block.location)
        });
        try { globalThis.refreshConnectedEnergy?.(block); } catch { /* ignore energy refresh */ }
        try { refreshEnergyGeometryAround(block); } catch { /* ignore geometry refresh */ }
        return;
    }

    const dim = block.dimension;

    const sourceEntity = dim.getEntitiesAtBlockLocation(block.location)[0];
    if (!sourceEntity) return;

    const OFFSETS = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
    ];

    const start = block.location;
    const queue = [start];
    let queueIndex = 0;
    const visited = new Set();
    const nodes = [];
    const MAX_VISITED = 2048;

    const isFluidContainer = (entity) => {
        try {
            return !!FluidManager.findType?.(entity, 0);
        } catch { return false; }
    };

    const targetTag = 'dorios:fluid';
    const isContainer = isFluidContainer;

    while (queueIndex < queue.length && visited.size <= MAX_VISITED) {
        const pos = queue[queueIndex++];
        const key = `${pos.x}|${pos.y}|${pos.z}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const nodeBlock = dim.getBlock(pos);
        const isTargetTagged = nodeBlock?.hasTag?.(targetTag);
        if (!nodeBlock || !isTargetTagged) continue;

        for (const off of OFFSETS) {
            queue.push({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z });
        }

        const [entity] = dim.getEntitiesAtBlockLocation(pos);
        if (!entity) continue;

        const isValidContainer = isContainer(entity);
        if (!isValidContainer) continue;

        if (pos.x === start.x && pos.y === start.y && pos.z === start.z) continue;

        nodes.push(pos);
    }

    const prop = "dorios:fluid_nodes";

    try {
        sourceEntity.setDynamicProperty(prop, JSON.stringify(nodes));
        sourceEntity.removeTag?.("updateNetwork");
    } catch { /* ignore storage errors */ }
}

// ─── Tick speed helpers ──────────────────────────────────────────────────────

export function sanitizeTickSpeed(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return DEFAULT_TICK_SPEED;
    }
    return numeric;
}

export function getTickSpeed() {
    const current = sanitizeTickSpeed(globalThis.tickSpeed);
    if (current !== globalThis.tickSpeed) {
        globalThis.tickSpeed = current;
    }
    return current;
}

export function resolveMachineEnergyRateUnits(settings, baseSpeedMultiplier, consumptionMultiplier) {
    const machineSettings = settings?.machine ?? {};
    const fixedRate = Number(machineSettings.fixed_rate ?? 0);

    if (Number.isFinite(fixedRate) && fixedRate > 0) {
        const perTick = fixedRate / TICKS_PER_SECOND;
        return Math.max(0, perTick) * baseSpeedMultiplier * consumptionMultiplier;
    }

    const rateSpeedBase = Number(machineSettings.rate_speed_base ?? 0);
    if (!Number.isFinite(rateSpeedBase) || rateSpeedBase <= 0) return 0;
    return rateSpeedBase * baseSpeedMultiplier * consumptionMultiplier;
}

export function resolveRecipeTimeSeconds(recipe) {
    if (!recipe || typeof recipe !== "object") return null;

    const candidates = [
        recipe.timeSeconds,
        recipe.seconds,
        recipe.time,
        recipe.processingTimeSeconds
    ];

    for (const value of candidates) {
        const seconds = Number(value);
        if (Number.isFinite(seconds) && seconds > 0) return seconds;
    }

    const ticks = Number(recipe.ticks ?? recipe.timeTicks ?? recipe.processingTicks ?? 0);
    if (Number.isFinite(ticks) && ticks > 0) {
        return ticks / TICKS_PER_SECOND;
    }

    return null;
}

/**
 * Adjusts a machine's rate so a recipe finishes in its configured time.
 *
 * @param {Machine} machine
 * @param {Object} recipe
 * @param {{ energyCost?: number, speedMultiplier?: number, consumptionMultiplier?: number }} [options]
 * @returns {boolean} True when a dynamic rate was applied.
 */
export function applyDynamicRecipeRate(machine, recipe, options = {}) {
    if (!machine || !recipe) return false;

    const timeSeconds = resolveRecipeTimeSeconds(recipe);
    if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) return false;

    const energyCost = Number(options.energyCost ?? recipe.energyCost ?? machine.getEnergyCost());
    if (!Number.isFinite(energyCost) || energyCost <= 0) return false;

    const speedCandidate = Number(options.speedMultiplier ?? machine.boosts?.speed ?? 1);
    const speedMultiplier = Number.isFinite(speedCandidate) && speedCandidate > 0 ? speedCandidate : 1;

    const consumptionCandidate = Number(options.consumptionMultiplier ?? machine.boosts?.consumption ?? 1);
    const consumptionMultiplier = Math.max(Number.EPSILON,
        Number.isFinite(consumptionCandidate) && consumptionCandidate > 0 ? consumptionCandidate : 1
    );

    const tickSpeed = getTickSpeed();
    const progressPerSecond = (energyCost / timeSeconds) * speedMultiplier;
    if (!Number.isFinite(progressPerSecond) || progressPerSecond <= 0) return false;

    const energyPerSecond = progressPerSecond * consumptionMultiplier;
    if (!Number.isFinite(energyPerSecond) || energyPerSecond <= 0) return false;

    const baseRate = Math.max(1, energyPerSecond / TICKS_PER_SECOND);
    machine.baseRate = baseRate;
    machine.rate = baseRate * tickSpeed;
    const hyperMultiplier = machine.boosts?.hyper ?? 1;
    machine.processingRate = baseRate * hyperMultiplier * tickSpeed;

    return true;
}

// ─── Label system ────────────────────────────────────────────────────────────

const MACHINE_LABELS = Object.freeze({
    colors: DoriosAPI.constants.textColors,
    splitRegex: /\r?\n/
});

const COLORS = MACHINE_LABELS.colors;
const splitRegex = MACHINE_LABELS.splitRegex;

function normalizeLoreEntries(entries) {
    if (!Array.isArray(entries)) return [];
    const lore = [];
    for (const entry of entries) {
        if (typeof entry !== "string") continue;
        for (const line of entry.split(splitRegex)) {
            const trimmed = line.trim();
            if (trimmed.length === 0) continue;
            const safeLine = trimmed.startsWith("§r") || trimmed === " "
                ? trimmed
                : `§r${trimmed}`;
            lore.push(truncateLabelText(safeLine));
        }
    }
    return lore;
}

function splitAndCleanLines(value) {
    if (typeof value !== "string") return [];
    return value
        .split(splitRegex)
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

function truncateLabelText(text, limit = LABEL_CHAR_LIMIT) {
    if (!text) return " ";
    if (text.length <= limit) return text;
    if (limit <= 3) return text.slice(0, limit);
    return `${text.slice(0, limit - 1)}...`;
}

function normalizeLabelContent(content) {
    if (typeof content === "string") {
        const lines = splitAndCleanLines(content);
        const collapsed = lines.join("\n") || " ";
        return { nameTag: truncateLabelText(collapsed), lore: [] };
    }

    if (!content || typeof content !== "object") {
        return { nameTag: " ", lore: [] };
    }

    const lore = normalizeLoreEntries(content.lore);

    if (typeof content.rawText === "string") {
        return {
            nameTag: truncateLabelText(content.rawText),
            lore
        };
    }

    const nameLines = [];

    const singleLineKeys = ["title", "subtitle", "name", "text"];
    for (const key of singleLineKeys) {
        const value = content[key];
        if (typeof value === "string") {
            nameLines.push(...splitAndCleanLines(value));
        }
    }

    const multiLineKeys = ["nameLines", "lines"];
    for (const key of multiLineKeys) {
        const value = content[key];
        if (Array.isArray(value)) {
            for (const entry of value) {
                if (typeof entry === "string") {
                    nameLines.push(...splitAndCleanLines(entry));
                }
            }
        } else if (typeof value === "string") {
            nameLines.push(...splitAndCleanLines(value));
        }
    }

    if (nameLines.length === 0) {
        nameLines.push(" ");
    }

    return {
        nameTag: truncateLabelText(nameLines.join("\n")),
        lore
    };
}

function extractMessageParts(message, fallback = "Status") {
    if (Array.isArray(message)) {
        const sanitized = message
            .map(entry => typeof entry === "string" ? entry.trim() : "")
            .filter(entry => entry.length > 0);
        const title = sanitized.shift() ?? fallback;
        return {
            title,
            requirements: sanitized
        };
    }

    const lines = splitAndCleanLines(typeof message === "string" ? message : "");
    const title = lines.shift() ?? fallback;
    return {
        title,
        requirements: lines
    };
}

function buildRequirementLore(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return [];
    return lines.map(line => `§r${COLORS.red}${line}`);
}

function sanitizeLabelLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return [];
    const sanitized = [];
    for (const entry of lines) {
        if (typeof entry !== "string") continue;
        const trimmed = entry.trim();
        if (!trimmed) continue;
        sanitized.push(trimmed.startsWith("§r") ? trimmed : `§r${trimmed}`);
    }
    return sanitized;
}

function appendLabelFooterSections(labelText, lines) {
    const sanitized = sanitizeLabelLines(lines);
    if (sanitized.length === 0) return labelText.trim();
    const base = labelText.trim();
    return `${base}\n\n${sanitized.join("\n")}`.trim();
}

/**
 * Builds a formatted overclock line for HUD/lore when the machine is overclocked.
 *
 * @param {Machine} machine
 * @returns {string|null}
 */
export function buildOverclockLoreLine(machine) {
    if (!machine || typeof machine.getOverclockClock !== "function") return null;
    const clock = machine.getOverclockClock();
    if (!Number.isFinite(clock) || clock <= 1) return null;
    return `§r§6Overclocked x${clock.toFixed(2)}`;
}

/**
 * Applies the normalized label content to an inventory slot.
 */
export function applyLabelToSlot(container, slot, content) {
    if (!container) return;
    const { nameTag, lore } = normalizeLabelContent(content);
    const baseItem = new ItemStack(LABEL_PLACEHOLDER_ITEM);
    baseItem.nameTag = nameTag;
    baseItem.setLore(lore);
    container.setItem(slot, baseItem);
}

/**
 * Applies multiple labels across given slots.
 */
export function applyLabels(container, contents, slots) {
    if (!container) return;
    const list = Array.isArray(contents) ? contents.filter(Boolean) : [contents];
    if (list.length === 0) return;
    const targetSlots = Array.isArray(slots) && slots.length > 0
        ? slots
        : list.map((_, i) => i);

    const count = Math.min(list.length, targetSlots.length);
    for (let i = 0; i < count; i++) {
        applyLabelToSlot(container, targetSlots[i], list[i]);
    }
}

// ─── Machine class ───────────────────────────────────────────────────────────

export class Machine {
    constructor(block, settings, ignoreTick = false) {
        this.valid = true
        if (globalThis.tickCount % globalThis.tickSpeed != 0 && !ignoreTick) {
            this.valid = false
            return
        }
        this.settings = settings
        this.dim = block.dimension
        this.block = block
        this.entity = this.dim.getEntitiesAtBlockLocation(block.location)[0]
        if (!this.entity) return null
        if (!this.entity.scoreboardIdentity) {
            Energy.initialize(this.entity)
        }
        this.inv = this.entity?.getComponent('inventory')?.container
        this.energy = new Energy(this.entity)
        if (this.entity.getDynamicProperty("dorios:base_energy_cap") === undefined && settings?.machine?.energy_cap) {
            this.entity.setDynamicProperty("dorios:base_energy_cap", settings.machine.energy_cap)
        }
        this.upgrades = this.getUpgradeLevels(settings.machine.upgrades)
        this.boosts = this.calculateBoosts(this.upgrades)

        this.overclock = this.readOverclockState()
        this.applyOverclockBoosts(settings)

        const baseSpeedMultiplier = this.boosts.baseSpeed ?? 1;
        const hyperMultiplier = this.boosts.hyper ?? 1;
        const energyRateUnits = resolveMachineEnergyRateUnits(settings, baseSpeedMultiplier, this.boosts.consumption);

        this.baseRate = energyRateUnits
        this.rate = this.baseRate * getTickSpeed()
        this.processingRate = this.baseRate * hyperMultiplier * getTickSpeed()
        this.hiddenSlots = Array.isArray(settings?.machine?.hidden_slots)
            ? settings.machine.hidden_slots.filter(slot => typeof slot === "number")
            : []
        this.overclockSlot = Number.isFinite(settings?.machine?.overclock_slot)
            ? Number(settings.machine.overclock_slot)
            : undefined

        if (this.overclockSlot === undefined && this.hiddenSlots.length && this.inv?.size) {
            const candidate = this.hiddenSlots.find(slot => slot >= 0 && slot < this.inv.size);
            if (candidate !== undefined) {
                this.overclockSlot = candidate;
            }
        }

        if (this.hiddenSlots.length) {
            this.fillHiddenSlots()
        }
    }

    setRate(baseRate) {
        this.baseRate = baseRate;
        const tickSpeed = getTickSpeed();
        this.rate = this.baseRate * tickSpeed;
        const hyperMultiplier = this.boosts?.hyper ?? 1;
        this.processingRate = this.baseRate * hyperMultiplier * tickSpeed;
        return this.rate;
    }

    getTransferCooldown() {
        return Math.max(0, this.entity.getDynamicProperty("dorios:transfer_cooldown") ?? 0);
    }

    setTransferCooldown(ticks) {
        this.entity.setDynamicProperty("dorios:transfer_cooldown", Math.max(0, Math.floor(ticks ?? 0)));
    }

    holdTransfers(ticks = 1) {
        if (!ticks || ticks <= 0) return;
        const current = this.getTransferCooldown();
        const desired = Math.max(current, Math.floor(ticks));
        this.setTransferCooldown(desired);
    }

    shouldDelayTransfers() {
        const cooldown = this.getTransferCooldown();
        if (cooldown <= 0) return false;
        this.setTransferCooldown(cooldown - 1);
        return true;
    }

    static spawn(block, data, blockToPlace) {
        const dim = block.dimension;
        const { entity } = data;

        const requestedId = entity?.identifier ?? entity?.id;
        const fallbackId = "utilitycraft:machine";
        let { x, y, z } = block.center(); y -= 0.25

        let machineEntity;
        try {
            machineEntity = dim.spawnEntity(requestedId ?? fallbackId, { x, y, z });
        } catch (err) {
            const strict = entity?.strict_entity_id === true;
            if (strict && requestedId) {
                throw err;
            }
            machineEntity = dim.spawnEntity(fallbackId, { x, y, z });
        }

        const isFluidMachine = entity?.fluid === true;

        let machineEvent;
        let fallbackFluidEvent = undefined;
        let inventorySize = 2
        if (!isFluidMachine) {
            if (entity.input_type === "simple" && entity.output_type === "simple") {
                machineEvent = "utilitycraft:simple_machine";
                inventorySize = 7
            } else if (entity.input_type === "complex" && entity.output_type === "simple") {
                machineEvent = "utilitycraft:complex_in_machine";
                inventorySize = 17
            } else if (entity.input_type === "simple" && entity.output_type === "complex") {
                machineEvent = "utilitycraft:complex_out_machine";
                inventorySize = 17
            } else if (entity.input_type === "complex" && entity.output_type === "complex") {
                machineEvent = "utilitycraft:complex_machine";
                inventorySize = 25
            } else if (entity.input_type === "simple") {
                machineEvent = "utilitycraft:simple_input_machine";
                inventorySize = 6
            } else {
                machineEvent = "utilitycraft:basic_machine";
            }
        } else {
            if (entity.input_type === "simple") {
                machineEvent = "utilitycraft:simple_machine_fluid";
            } else if (entity.input_type === "complex") {
                machineEvent = "utilitycraft:complex_machine_fluid";
            } else {
                machineEvent = "utilitycraft:simple_machine_fluid";
            }

            fallbackFluidEvent = machineEvent;
        }

        if (entity.inventory_size) inventorySize = entity.inventory_size

        if (!entity.input_slots) {
            if (entity.input_range) entity.input_slots = entity.input_range;
            else if (entity.input_slot !== undefined) entity.input_slots = [entity.input_slot, entity.input_slot];
        }
        if (!entity.output_slots) {
            if (entity.output_range) entity.output_slots = entity.output_range;
            else if (entity.output_slot !== undefined) entity.output_slots = [entity.output_slot, entity.output_slot];
        }

        if (entity.input_slots || entity.output_slots) {
            const slotRegister = {};
            if (entity.input_slots) {
                slotRegister.input = entity.input_slots;
            }

            if (entity.output_slots) {
                slotRegister.output = entity.output_slots;
            }

            machineEvent = isFluidMachine ? "utilitycraft:special_machine_fluid" : "utilitycraft:special_machine";
            machineEntity.runCommand(`scriptevent dorios:special_container ${JSON.stringify(slotRegister)}`);
        }

        const inventoryEvent = `utilitycraft:inventory_${inventorySize}`;

        if (!entity?.skip_machine_event && machineEvent) {
            try { machineEntity.triggerEvent(machineEvent); } catch { /* ignore invalid machine event */ }
        }

        if (isFluidMachine) {
            let hasFluidFamily = false;
            try {
                const tf = machineEntity.getComponent("minecraft:type_family");
                hasFluidFamily = tf?.hasTypeFamily("dorios:fluid_container") === true;
            } catch { /* ignore */ }

            if (!hasFluidFamily && fallbackFluidEvent && fallbackFluidEvent !== machineEvent) {
                try {
                    machineEntity.triggerEvent(fallbackFluidEvent);
                } catch {
                    // ignore fallback failure
                }
            }
        }

        if (!entity?.skip_inventory_event) {
            try { machineEntity.triggerEvent(inventoryEvent); } catch { /* ignore invalid inventory event */ }

            const currentInvSize = machineEntity.getComponent("inventory")?.container?.size;
            if (currentInvSize !== inventorySize) {
                try { machineEntity.triggerEvent(inventoryEvent); } catch { /* ignore second attempt */ }
            }

            system.run(() => {
                const deferredSize = machineEntity.getComponent("inventory")?.container?.size;
                if (deferredSize !== inventorySize) {
                    try { machineEntity.triggerEvent(inventoryEvent); } catch { /* ignore deferred failure */ }
                }
            });
        }

        const name = blockToPlace.type.id.split(':')[1] ?? entity.name
        machineEntity.nameTag = `entity.utilitycraft:${name}.name`;

        return machineEntity;
    }

    static onDestroy(e) {
        const { block, brokenBlockPermutation, player, dimension: dim } = e;
        const entity = dim.getEntitiesAtBlockLocation(block.location)[0];
        if (!entity) return false;

        const energy = new Energy(entity);
        const fluid = new FluidManager(entity)
        const blockItemId = brokenBlockPermutation.type.id
        const blockItem = new ItemStack(blockItemId);
        const lore = [];

        if (energy.get() > 0) {
            lore.push(`§r§7  Energy: ${Energy.formatEnergyToText(energy.get())}/${Energy.formatEnergyToText(energy.cap)}`);
        }

        if (fluid.type != 'empty') {
            const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type)
            lore.push(`§r§7  ${liquidName}: ${FluidManager.formatFluid(fluid.get())}/${FluidManager.formatFluid(fluid.cap)}`);
        }

        if (lore.length > 0) {
            blockItem.setLore(lore);
        }

        system.run(() => {
            if (player?.isInSurvival()) {
                const oldItemEntity = dim.getEntities({ type: 'item', maxDistance: 3, location: block.center() })
                    .find(item => item.getComponent('minecraft:item')?.itemStack?.typeId === blockItemId);
                oldItemEntity?.remove()
            };
            Machine.dropAllItems(entity);
            entity.remove();
            dim.spawnItem(blockItem, block.center());
        });
        return true
    }

    static spawnMachineEntity(e, settings, callback) {
        const { block, player, permutationToPlace } = e
        const maindHand = player.getComponent('equippable').getEquipment('Mainhand')

        if (settings.rotation) {
            if (player.isInSurvival()) system.run(() => {
                player.runCommand(`clear @s ${permutationToPlace.type.id} 0 1`)
            })
            e.cancel = true
            Rotation.facing(player, block, permutationToPlace)
        }

        const itemInfo = Array.isArray(maindHand.getLore()) ? maindHand.getLore() : [];
        let energy = 0;
        let fluid = undefined;

        for (const line of itemInfo) {
            if (!energy && typeof line === 'string' && line.includes('Energy')) {
                energy = Energy.getEnergyFromText(line);
            }
        }

        for (const line of itemInfo) {
            if (!fluid) {
                const parsed = FluidManager.getFluidFromText(line);
                const parsedLegacyGas = (!parsed?.type || parsed.type === 'empty' || parsed.amount <= 0)
                    ? GasManager.getGasFromText(line)
                    : null;
                const candidate = parsedLegacyGas ?? parsed;
                if (candidate?.type && candidate.type !== 'empty' && candidate.amount > 0) {
                    fluid = candidate;
                }
            }
            if (fluid) break;
        }

        const shouldUpdateEnergy = permutationToPlace?.hasTag?.('dorios:energy');
        const shouldUpdateFluid = permutationToPlace?.hasTag?.('dorios:fluid');

        if (shouldUpdateEnergy || shouldUpdateFluid) {
            system.runTimeout(() => {
                const dim = block.dimension;
                const offsets = [
                    { x: 1, y: 0, z: 0 },
                    { x: -1, y: 0, z: 0 },
                    { x: 0, y: 1, z: 0 },
                    { x: 0, y: -1, z: 0 },
                    { x: 0, y: 0, z: 1 },
                    { x: 0, y: 0, z: -1 },
                ];

                const refresh = (type, tag) => {
                    updatePipes(block, type);
                    for (const off of offsets) {
                        const neighbor = dim.getBlock({
                            x: block.location.x + off.x,
                            y: block.location.y + off.y,
                            z: block.location.z + off.z,
                        });
                        if (neighbor?.hasTag?.(tag)) {
                            updatePipes(neighbor, type);
                        }
                    }
                };

                if (shouldUpdateEnergy) refresh('energy', 'dorios:energy');
                if (shouldUpdateFluid) refresh('fluid', 'dorios:fluid');
            }, 2);
        }

        system.run(() => {
            const entity = Machine.spawn(block, settings, permutationToPlace)

            Energy.initialize(entity)
            const energyManager = new Energy(entity)
            if (settings?.machine?.energy_cap) {
                entity.setDynamicProperty("dorios:base_energy_cap", settings.machine.energy_cap)
            }
            energyManager.set(energy)
            energyManager.setCap(settings.machine.energy_cap)
            energyManager.display()

            if (settings.machine.fluid_cap) {
                entity.setDynamicProperty("dorios:base_fluid_cap", settings.machine.fluid_cap)
                const fluidManager = new FluidManager(entity, 0)
                fluidManager.setCap(settings.machine.fluid_cap)

                if (fluid && fluid.amount > 0) {
                    fluidManager.setType(fluid.type)
                    fluidManager.set(fluid.amount)
                }
            }
            try { globalThis.refreshOverclockNetwork?.(block); } catch { /* ignore overclock refresh */ }
            try { globalThis.refreshConnectedEnergy?.(block); } catch { /* ignore energy refresh */ }
            if (shouldUpdateEnergy) {
                system.runTimeout(() => {
                    try { globalThis.refreshConnectedEnergy?.(block); } catch { /* ignore energy refresh */ }
                }, 10);
            }
            system.run(() => { if (callback) callback(entity) })
        });
    }

    transferItems(type = this.settings.entity.output_type ?? "simple") {
        if (this.shouldDelayTransfers()) return false;
        const facing = this.block.getState("utilitycraft:axis");
        if (!facing) return false;

        const opposites = {
            east: [-1, 0, 0],
            west: [1, 0, 0],
            north: [0, 0, 1],
            south: [0, 0, -1],
            up: [0, -1, 0],
            down: [0, 1, 0]
        };

        const offset = opposites[facing];
        if (!offset) return false;

        const { x, y, z } = this.block.location;
        const targetLoc = { x: x + offset[0], y: y + offset[1], z: z + offset[2] };

        let range;
        if (type === "complex") {
            const end = this.inv.size - 1;
            const start = Math.max(0, end - 8);
            range = [start, end];
        } else {
            range = this.inv.size - 1;
        }

        DoriosAPI.containers.transferItemsAt(this.inv, targetLoc, this.dim, range);
        return true;
    }

    pullItemsFromAbove(targetSlot) {
        const inv = this.inv
        const block = this.block

        const aboveBlock = block.above(1);
        if (!aboveBlock) return false;

        if (!DoriosAPI.constants.vanillaContainers.includes(aboveBlock.typeId)) return false;

        const inputContainer = aboveBlock.getComponent("minecraft:inventory")?.container;
        if (!inputContainer) return false;

        const targetItem = inv.getItem(targetSlot);
        let transferred = false;
        for (let i = 0; i < inputContainer.size; i++) {
            const inputItem = inputContainer.getItem(i);
            if (!inputItem) continue;

            if (targetItem && inputItem.typeId !== targetItem.typeId) continue;

            if (!targetItem) {
                inv.setItem(targetSlot, inputItem)
                inputContainer.setItem(i,);
                return true
            }

            const space = targetItem.maxAmount - targetItem.amount;
            const amount = Math.min(space, inputItem.amount)

            if (amount <= 0) continue;

            targetItem.amount += amount;
            inv.setItem(targetSlot, targetItem);
            if (inputItem.amount - amount <= 0) {
                inputContainer.setItem(i,);
            } else {
                inputItem.amount -= amount
                inputContainer.setItem(i, inputItem);
            }

            return transferred;
        }
    }

    setLabel(content, slot = 1) {
        applyLabelToSlot(this.inv, slot, content);
    }

    setLabels(contents, slots) {
        applyLabels(this.inv, contents, slots);
    }

    on() {
        this.block.setState('utilitycraft:on', true)
    }

    off() {
        this.block.setState('utilitycraft:on', false)
    }

    //#region Progress
    addProgress(amount) {
        if (typeof amount !== "number" || amount === 0) return;
        const key = "dorios:progress";
        const hyper = this.boosts?.hyper ?? 1;
        const delta = amount > 0 ? amount * hyper : amount;
        let current = this.entity.getDynamicProperty(key) ?? 0;
        this.entity.setDynamicProperty(key, current + delta);
    }

    setProgress(value, slot = 2, type = "arrow_right", display = true) {
        this.entity.setDynamicProperty("dorios:progress", Math.max(0, value));
        if (display) this.displayProgress(slot, type)
    }

    getProgress() {
        return this.entity.getDynamicProperty("dorios:progress") ?? 0;
    }

    setEnergyCost(value) {
        this.entity.setDynamicProperty("dorios:energy_cost", Math.max(1, value));
    }

    getEnergyCost() {
        return this.entity.getDynamicProperty("dorios:energy_cost") ?? 800;
    }

    displayProgress(slot = 2, type = "arrow_right") {
        const inv = this.entity.getComponent("minecraft:inventory")?.container;
        if (!inv) return;

        const progress = this.getProgress();
        const max = this.getEnergyCost();
        const normalized = Math.min(16, Math.floor((progress / max) * 16));

        const itemId = `utilitycraft:${type}_${normalized}`;
        inv.setItem(slot, new ItemStack(itemId, 1));
    }

    addFractionalItem(itemId, amount) {
        if (!itemId || typeof amount !== "number" || amount <= 0) return 0;
        
        const key = `dorios:frac_${itemId.replace(/:/g, "_")}`;
        const current = Number(this.entity.getDynamicProperty(key) ?? 0);
        const newTotal = current + amount;
        const integerPart = Math.floor(newTotal);
        const fractionalPart = newTotal - integerPart;
        
        this.entity.setDynamicProperty(key, fractionalPart);
        return integerPart;
    }

    getFractionalItem(itemId) {
        if (!itemId) return 0;
        const key = `dorios:frac_${itemId.replace(/:/g, "_")}`;
        return Number(this.entity.getDynamicProperty(key) ?? 0);
    }

    resetFractionalItem(itemId) {
        if (!itemId) return;
        const key = `dorios:frac_${itemId.replace(/:/g, "_")}`;
        this.entity.setDynamicProperty(key, 0);
    }
    //#endregion

    displayEnergy(slot = 0) {
        this.energy.display(slot);
    }

    getOverclockStrength() {
        const level = Number(this.overclock?.level ?? 0);
        const effectiveness = Number(this.overclock?.effectiveness ?? 0);
        return Math.max(0, level * effectiveness);
    }

    getOverclockClock() {
        const strength = this.getOverclockStrength();
        const clock = 1 + 0.35 * strength;
        return Math.max(1, clock);
    }

    getOverclockYieldMultiplier() {
        return Math.max(1, Math.floor(this.getOverclockClock()));
    }

    displayOverclock(slot = this.overclockSlot) {
        if (slot === undefined || slot === null) return;
        if (!Number.isFinite(slot)) return;

        const container = this.entity.getComponent("minecraft:inventory")?.container;
        if (!container) return;
        if (slot < 0 || slot >= container.size) return;

        const clock = this.getOverclockClock();
        const frameClock = Math.min(clock, 3);
        const frame = Math.max(0, Math.min(48, Math.floor(((frameClock - 1) / 2) * 48)));
        const frameName = frame.toString().padStart(2, "0");

        const prevClock = Number(this.entity.getDynamicProperty("dorios:last_overclock_clock") ?? clock);
        const epsilon = 0.001;
        let state = "Stable";
        if (clock > prevClock + epsilon) state = "Increasing";
        else if (clock < prevClock - epsilon) state = "Decreasing";
        this.entity.setDynamicProperty("dorios:last_overclock_clock", clock);

        const formatClock = (value) => {
            if (value >= 10) return value.toFixed(2);
            return value.toFixed(3);
        };

        const item = new ItemStack(`utilitycraft:overclock_${frameName}`, 1);
        item.nameTag = `§r§5Overclock\n§r§6Clock: ${formatClock(clock)}x\n§r§7State: ${state}`;

        container.setItem(slot, item);
    }

    showWarning(message, resetProgress = true, extraLore = [], options = undefined) {
        if (resetProgress) {
            this.setProgress(0);
        }

        this.displayEnergy();
        this.off()
        const { title, requirements } = extractMessageParts(message, "Warning");
        const efficiency = ((1 / this.boosts.consumption) * 100).toFixed(0);
        const rateText = Energy.formatEnergyToText(Math.floor(this.baseRate));
        const overclockClock = Number(this.boosts.overclockClock ?? 1);
        const overclockLine = overclockClock > 1 ? `\n§r§6Overclocked x${overclockClock.toFixed(2)}` : "";

        let labelText = `
§r${COLORS.yellow}${title}!

§r${COLORS.green}Speed x${this.boosts.speed.toFixed(2)}
§r${COLORS.green}Efficiency ${efficiency}%%
§r${COLORS.green}Cost ---

§r${COLORS.red}Rate ${rateText}/t
${overclockLine}
        `.trim();

        if (options?.footerLines) {
            labelText = appendLabelFooterSections(labelText, options.footerLines);
        }

        const lore = buildRequirementLore(requirements);
        if (Array.isArray(extraLore) && extraLore.length) {
            if (lore.length > 0) lore.push(" ");
            lore.push(...extraLore);
        }

        this.displayOverclock();
        this.setLabel({
            rawText: labelText,
            lore
        });
    }

    showStatus(message, extraLore = [], options = undefined) {
        this.displayEnergy();
        this.displayOverclock();
        const { title, requirements } = extractMessageParts(message, "Operational");
        const efficiency = ((1 / this.boosts.consumption) * 100).toFixed(0);
        const costText = Energy.formatEnergyToText(this.getEnergyCost() * this.boosts.consumption);
        const rateText = Energy.formatEnergyToText(Math.floor(this.baseRate));
        const overclockClock = Number(this.boosts.overclockClock ?? 1);
        const overclockLine = overclockClock > 1 ? `\n§r§6Overclocked x${overclockClock.toFixed(2)}` : "";

        let labelText = `
§r${COLORS.darkGreen}${title}!

§r${COLORS.green}Speed x${this.boosts.speed.toFixed(2)}
§r${COLORS.green}Efficiency ${efficiency}%%
§r${COLORS.green}Cost ${costText}

§r${COLORS.red}Rate ${rateText}/t
    ${overclockLine}
        `.trim();

        if (options?.footerLines) {
            labelText = appendLabelFooterSections(labelText, options.footerLines);
        }

        const lore = buildRequirementLore(requirements);
        if (Array.isArray(extraLore) && extraLore.length) {
            if (lore.length > 0) lore.push(" ");
            lore.push(...extraLore);
        }

        this.setLabel({
            rawText: labelText,
            lore
        });
    }

    getUpgradeLevels(slots = [4, 5, 6]) {
        const levels = {
            energy: 0,
            range: 0,
            speed: 0,
            size: 0,
            ultimate: 0,
            hyper: 0
        };

        const invSize = this.inv?.size ?? 0;
        if (invSize <= 0) return levels;

        for (const slot of slots) {
            if (typeof slot !== "number") continue;
            if (slot < 0 || slot >= invSize) continue;

            const item = this.inv.getItem(slot);
            if (!item) continue;

            if (!item.hasTag("utilitycraft:is_upgrade")) continue;

            const [, raw] = item.typeId.split(":");
            const type = raw.split("_")[0];

            if (levels[type] !== undefined) {
                levels[type] += item.amount;
            }
        }

        return levels;
    }

    calculateSpeed(speedAmount) {
        const speedLevel = Math.min(8, speedAmount)
        return 1 + 0.125 * speedLevel * (speedLevel + 1);
    }

    calculateHyperBoost(hyperAmount) {
        const hyperLevel = Math.min(8, hyperAmount);
        if (hyperLevel <= 0) return { speedBoost: 1, yieldBoost: 1, theoretical: 1 };
        
        const theoretical = 1 + 0.075 * hyperLevel * (hyperLevel + 1);
        
        const speedComponent = 1 + (theoretical - 1) * 0.4;
        const yieldComponent = 1 + (theoretical - 1) * 0.6;
        
        return { speedBoost: speedComponent, yieldBoost: yieldComponent, theoretical };
    }

    calculateConsumption(energyAmount, speed) {
        const energyLevel = Math.min(8, energyAmount)
        if (energyLevel < 4) {
            return (1 - 0.2 * energyLevel) * speed;
        }
        return (1 - (0.95 - 0.05 * (8 - energyLevel))) * speed;
    }

    calculateBoosts(levels) {
        const speedLevel = levels.speed ?? 0;
        const hyperLevel = levels.hyper ?? 0;
        const energyLevel = levels.energy ?? 0;

        const baseSpeed = this.calculateSpeed(speedLevel);
        const hyperBoost = this.calculateHyperBoost(hyperLevel);
        const speed = baseSpeed * hyperBoost.speedBoost;
        const consumption = this.calculateConsumption(energyLevel, baseSpeed);

        return { 
            speed, 
            consumption, 
            hyper: hyperBoost.speedBoost, 
            hyperYield: hyperBoost.yieldBoost,
            hyperTheoretical: hyperBoost.theoretical,
            baseSpeed 
        };
    }

    readOverclockState() {
        if (!this.entity) return { level: 0, effectiveness: 0, ttl: 0 };

        const level = Number(this.entity.getDynamicProperty("dorios:overclock_level") ?? 0);
        let ttl = Number(this.entity.getDynamicProperty("dorios:overclock_ttl") ?? 0);
        const effectiveness = Number(this.entity.getDynamicProperty("dorios:overclock_eff") ?? 0);

        if (ttl > 0) {
            this.entity.setDynamicProperty("dorios:overclock_ttl", ttl - 1);
        } else if (level > 0) {
            this.entity.setDynamicProperty("dorios:overclock_level", 0);
            this.entity.setDynamicProperty("dorios:overclock_eff", 0);
        }

        return { level, effectiveness, ttl };
    }

    getBaseEnergyCap(settings) {
        const baseProp = this.entity?.getDynamicProperty("dorios:base_energy_cap");
        if (typeof baseProp === "number" && baseProp > 0) return baseProp;
        if (settings?.machine?.energy_cap) return settings.machine.energy_cap;
        if (typeof this.energy?.cap === "number" && this.energy.cap > 0) return this.energy.cap;
        return 0;
    }

    applyEnergyCapBoost(multiplier, settings) {
        if (!this.energy || !multiplier || multiplier <= 0) return;
        const baseCap = this.getBaseEnergyCap(settings);
        if (!baseCap) return;

        const desired = Math.max(baseCap, Math.floor(baseCap * multiplier));
        if (desired !== this.energy.getCap()) {
            this.energy.setCap(desired);
        }
    }

    restoreBaseEnergyCap(settings) {
        if (!this.energy) return;
        const baseCap = this.getBaseEnergyCap(settings);
        if (!baseCap) return;

        const current = this.energy.get();
        const desired = Math.max(baseCap, current);
        if (desired !== this.energy.getCap()) {
            this.energy.setCap(desired);
        }
    }

    getBaseFluidCap(settings) {
        const baseProp = this.entity?.getDynamicProperty("dorios:base_fluid_cap");
        if (typeof baseProp === "number" && baseProp > 0) return baseProp;
        if (settings?.machine?.fluid_cap) return settings.machine.fluid_cap;
        try {
            const fluid = new FluidManager(this.entity, 0);
            if (typeof fluid?.cap === "number" && fluid.cap > 0) return fluid.cap;
        } catch { /* ignore if entity doesn't have fluid */ }
        return 0;
    }

    applyFluidCapBoost(multiplier, settings) {
        if (!multiplier || multiplier <= 0) return;
        const baseCap = this.getBaseFluidCap(settings);
        if (!baseCap) return;

        try {
            const fluid = new FluidManager(this.entity, 0);
            const desired = Math.max(baseCap, Math.floor(baseCap * multiplier));
            if (desired !== fluid.getCap()) {
                fluid.setCap(desired);
            }
        } catch { /* ignore if entity doesn't have fluid */ }
    }

    restoreBaseFluidCap(settings) {
        const baseCap = this.getBaseFluidCap(settings);
        if (!baseCap) return;

        try {
            const fluid = new FluidManager(this.entity, 0);
            const current = fluid.get();
            const desired = Math.max(baseCap, current);
            if (desired !== fluid.getCap()) {
                fluid.setCap(desired);
            }
        } catch { /* ignore if entity doesn't have fluid */ }
    }

    applyOverclockBoosts(settings) {
        if (!this.overclock || this.overclock.level <= 0 || this.overclock.effectiveness <= 0) {
            this.boosts.overclockClock = 1;
            if (!this.boosts.hyperYield) {
                this.boosts.overclockYield = 1;
            } else {
                this.boosts.overclockYield = this.boosts.hyperYield;
            }
            this.restoreBaseEnergyCap(settings);
            this.restoreBaseFluidCap(settings);
            return;
        }

        const strength = Math.max(0, this.overclock.level * this.overclock.effectiveness);
        if (strength <= 0) {
            this.boosts.overclockClock = 1;
            if (!this.boosts.hyperYield) {
                this.boosts.overclockYield = 1;
            } else {
                this.boosts.overclockYield = this.boosts.hyperYield;
            }
            this.restoreBaseEnergyCap(settings);
            this.restoreBaseFluidCap(settings);
            return;
        }

        const theoreticalClock = 1 + 0.35 * strength;
        
        let speedMult = Math.min(2, theoreticalClock);
        let yieldMult = 1;
        let consumptionMult = 1 + 0.25 * strength;
        
        if (theoreticalClock > 2) {
            const excessMultiplier = theoreticalClock / 2;
            yieldMult = excessMultiplier;
            consumptionMult *= excessMultiplier;
        }
        
        const capacityMult = 1 + 0.25 * strength;

        this.boosts.baseSpeed = (this.boosts.baseSpeed ?? 1) * speedMult;
        this.boosts.speed = (this.boosts.speed ?? 1) * speedMult;
        this.boosts.consumption = (this.boosts.consumption ?? 1) * consumptionMult;
        this.boosts.overclockCapacity = capacityMult;
        this.boosts.overclockClock = theoreticalClock;
        
        const hyperYield = this.boosts.hyperYield ?? 1;
        this.boosts.overclockYield = yieldMult * hyperYield;

        this.applyEnergyCapBoost(capacityMult, settings);
        this.applyFluidCapBoost(capacityMult, settings);
    }

    blockSlots(slots) {
        for (const index of slots) {
            if (!this.inv.getItem(index)) {
                this.inv.setItem(index, new ItemStack("utilitycraft:arrow_right_0", 1));
            }
        }
    }

    fillHiddenSlots(slots = this.hiddenSlots, fillerId = HIDDEN_SLOT_FILLER_ITEM) {
        if (!Array.isArray(slots) || slots.length === 0) return;
        if (!this.inv || !this.entity) return;

        for (const slot of slots) {
            if (typeof slot !== "number") continue;
            if (slot < 0 || slot >= this.inv.size) continue;

            const current = this.inv.getItem(slot);
            if (current) continue;

            this.entity.setItem(slot, fillerId, 1);
        }
    }

    unblockSlots(slots) {
        for (const index of slots) {
            const item = this.inv.getItem(index);
            if (item && item.typeId === "utilitycraft:arrow_right_0") {
                this.inv.setItem(index, undefined);
            }
        }
    }

    static dropAllItems(entity) {
        const inv = entity.getComponent("minecraft:inventory")?.container;
        if (!inv) return;

        const dim = entity.dimension;
        const center = entity.location;

        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (!item) continue;

            if (item.hasTag("utilitycraft:ui_element")) continue;

            const typeId = item.typeId ?? "";
            if (typeId.startsWith("utilitycraft:cryofluid_")) continue;

            dim.spawnItem(item, center);

            inv.setItem(i, undefined);
        }
    }
}

// ─── Container class ─────────────────────────────────────────────────────────

/**
 * Lightweight wrapper to treat large storage blocks as "containers" while
 * reusing the existing Machine utilities (energy, fluids, transfers, labels).
 */
export class Container {
    constructor(block, settings, ignoreTick = false) {
        this.settings = Container.normalizeSettings(settings);
        this.machine = new Machine(block, this.settings, ignoreTick);

        this.valid = this.machine.valid;
        this.dim = this.machine.dim;
        this.block = this.machine.block;
        this.entity = this.machine.entity;
        this.inv = this.machine.inv;
        this.energy = this.machine.energy;
        this.hiddenSlots = this.machine.hiddenSlots ?? [];
    }

    static normalizeSettings(settings = {}) {
        const entity = { ...(settings.entity ?? {}) };
        const container = { ...(settings.container ?? {}) };
        const machine = { ...(settings.machine ?? {}) };

        if (entity.skip_machine_event === undefined) entity.skip_machine_event = true;
        if (entity.skip_inventory_event === undefined) entity.skip_inventory_event = true;
        if (entity.input_type === undefined) entity.input_type = null;
        if (entity.output_type === undefined) entity.output_type = null;

        if (container.inventory_size && !entity.inventory_size) {
            entity.inventory_size = container.inventory_size;
        }

        if ((entity.inventory_size ?? 0) > 64 && entity.skip_inventory_event === undefined) {
            entity.skip_inventory_event = true;
        }

        if (!Array.isArray(machine.hidden_slots) && Array.isArray(container.hidden_slots)) {
            machine.hidden_slots = container.hidden_slots;
        }

        if (container.energy_cap && !machine.energy_cap) machine.energy_cap = container.energy_cap;
        if (container.fluid_cap && !machine.fluid_cap) machine.fluid_cap = container.fluid_cap;

        return { ...settings, entity, machine, container };
    }

    static spawnContainerEntity(e, settings, callback) {
        const normalized = Container.normalizeSettings(settings);
        const { block, player, permutationToPlace } = e;
        const mainHand = player.getComponent('equippable').getEquipment('Mainhand');

        if (normalized.rotation) {
            if (player.isInSurvival()) system.run(() => {
                player.runCommand(`clear @s ${permutationToPlace.type.id} 0 1`);
            });
            e.cancel = true;
            Rotation.facing(player, block, permutationToPlace);
        }

        const itemInfo = Array.isArray(mainHand.getLore()) ? mainHand.getLore() : [];
        let energy = 0;
        let fluid = undefined;

        for (const line of itemInfo) {
            if (!energy && typeof line === 'string' && line.includes('Energy')) {
                energy = Energy.getEnergyFromText(line);
            }
        }

        for (const line of itemInfo) {
            if (!fluid) {
                const parsed = FluidManager.getFluidFromText(line);
                const parsedLegacyGas = (!parsed?.type || parsed.type === 'empty' || parsed.amount <= 0)
                    ? GasManager.getGasFromText(line)
                    : null;
                const candidate = parsedLegacyGas ?? parsed;
                if (candidate?.type && candidate.type !== 'empty' && candidate.amount > 0) {
                    fluid = candidate;
                }
            }
            if (fluid) break;
        }

        system.run(() => {
            const entity = Machine.spawn(block, normalized, permutationToPlace);

            Energy.initialize(entity);
            const energyManager = new Energy(entity);
            if (normalized?.machine?.energy_cap) {
                entity.setDynamicProperty("dorios:base_energy_cap", normalized.machine.energy_cap);
            }
            energyManager.set(energy);
            energyManager.setCap(normalized.machine.energy_cap ?? 0);

            const shouldDisplayEnergyItem = normalized.container?.display_energy_item ?? false;
            if (shouldDisplayEnergyItem) {
                energyManager.display(normalized.container?.energy_display_slot ?? 0);
            }

            if (normalized.machine.fluid_cap) {
                const fluidManager = new FluidManager(entity, 0);
                fluidManager.setCap(normalized.machine.fluid_cap);

                if (fluid && fluid.amount > 0) {
                    fluidManager.setType(fluid.type);
                    fluidManager.set(fluid.amount);
                }
            }

                system.run(() => {
                    if (normalized.machine.hidden_slots?.length) {
                        const container = new Container(block, normalized, true);
                        container.fillHiddenSlots(normalized.machine.hidden_slots);
                    }
                    try { globalThis.refreshOverclockNetwork?.(block); } catch { /* ignore overclock refresh */ }
                    try { globalThis.refreshConnectedEnergy?.(block); } catch { /* ignore energy refresh */ }
                    system.runTimeout(() => {
                        try { globalThis.refreshConnectedEnergy?.(block); } catch { /* ignore energy refresh */ }
                    }, 10);
                    if (callback) callback(entity);
                });
        });
    }

    // Convenience: mirror common Machine instance helpers
    setLabel(...args) { return this.machine.setLabel(...args); }
    setLabels(...args) { return this.machine.setLabels(...args); }
    setEnergyCost(...args) { return this.machine.setEnergyCost(...args); }
    on(...args) { return this.machine.on(...args); }
    off(...args) { return this.machine.off(...args); }
    transferItems(...args) { return this.machine.transferItems(...args); }
    getTransferCooldown(...args) { return this.machine.getTransferCooldown(...args); }
    setTransferCooldown(...args) { return this.machine.setTransferCooldown(...args); }
    holdTransfers(...args) { return this.machine.holdTransfers(...args); }
    shouldDelayTransfers(...args) { return this.machine.shouldDelayTransfers(...args); }
    blockSlots(...args) { return this.machine.blockSlots(...args); }
    fillHiddenSlots(...args) { return this.machine.fillHiddenSlots(...args); }
    unblockSlots(...args) { return this.machine.unblockSlots(...args); }

    static dropAllItems(entity) { return Machine.dropAllItems(entity); }
}
