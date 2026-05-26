import { world, system, ItemStack } from "@minecraft/server";
import { loadObjectives } from "../utils/scoreboards.js";
import { shouldRefreshEntityUi } from "./ui_refresh.js";

// ─── Fluid/Gas registries ────────────────────────────────────────────────────
const FLUID_STORAGE_EVENTS = Object.freeze({
    fluid: Object.freeze({
        registerContainer: "utilitycraft:register_fluid_container",
        registerOutput: "utilitycraft:register_fluid_output"
    }),
    gas: Object.freeze({
        registerContainer: "utilitycraft:register_gas_container",
        registerOutput: "utilitycraft:register_gas_output"
    })
});

const FLUID_STORAGE_RUNTIME = {
    fluidContainerRegistry: Object.create(null),
    fluidOutputRegistry: Object.create(null),
    fluidHolderRegistry: Object.create(null)
};

const fluidContainerRegistry = FLUID_STORAGE_RUNTIME.fluidContainerRegistry;
const fluidOutputRegistry = FLUID_STORAGE_RUNTIME.fluidOutputRegistry;
const fluidHolderRegistry = FLUID_STORAGE_RUNTIME.fluidHolderRegistry;
const gasContainerRegistry = FLUID_STORAGE_RUNTIME.fluidContainerRegistry;
const gasOutputRegistry = FLUID_STORAGE_RUNTIME.fluidOutputRegistry;
const gasHolderRegistry = FLUID_STORAGE_RUNTIME.fluidHolderRegistry;

const FLUID_STORAGE_DEFAULTS = Object.freeze({
    infiniteFluidCapFallback: 1_024_000
});

// ─── Sanitizers ──────────────────────────────────────────────────────────────
const sanitizeFluidType = (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";

const sanitizeGasType = (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";

const clampFluidAmount = (value) => {
    const amount = Math.floor(Number(value) || 0);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const normalizeAmountRange = (value) => {
    if (typeof value === "number") {
        const amount = clampFluidAmount(value);
        return amount ? { min: amount, max: amount } : null;
    }

    if (Array.isArray(value)) {
        const [rawMin, rawMax] = value;
        const max = clampFluidAmount(rawMax ?? rawMin);
        if (!max) return null;
        const min = clampFluidAmount(rawMin) || max;
        const low = Math.min(min, max);
        const high = Math.max(min, max);
        return { min: low, max: high };
    }

    if (typeof value === "object" && value) {
        const rawMin = value.min ?? value.minimum ?? value[0];
        const rawMax = value.max ?? value.maximum ?? value[1] ?? rawMin;
        const max = clampFluidAmount(rawMax);
        if (!max) return null;
        const min = clampFluidAmount(rawMin) || max;
        const low = Math.min(min, max);
        const high = Math.max(min, max);
        return { min: low, max: high };
    }

    return null;
};

// ─── Normalization helpers ───────────────────────────────────────────────────
function normalizeFluidContainer(definition) {
    if (!definition) return null;

    const amountRange = normalizeAmountRange(definition.amount);
    const type = sanitizeFluidType(definition.type ?? definition.fluid ?? definition.liquid);

    if (!amountRange || !type) return null;

    const normalized = {
        amount: amountRange.max,
        amountRange,
        minAmount: amountRange.min,
        type
    };

    if (definition.infinite === true) {
        normalized.infinite = true;
    }

    const output = definition.output ?? definition.result ?? definition.empty ?? definition.returnItem;
    if (typeof output === "string" && output.length > 0) {
        normalized.output = output;
    }

    return Object.freeze(normalized);
}

function normalizeFluidOutput(definition) {
    if (!definition) return null;

    const amountRange = normalizeAmountRange(definition.amount ?? definition.requirement);
    if (!amountRange) return null;

    const rawFills = definition.fills ?? definition.outputs ?? definition.types;
    if (!rawFills || typeof rawFills !== "object") return null;

    const fills = {};
    for (const [rawType, itemId] of Object.entries(rawFills)) {
        const type = sanitizeFluidType(rawType);
        if (!type) continue;
        if (typeof itemId !== "string" || itemId.length === 0) continue;
        fills[type] = itemId;
    }

    if (Object.keys(fills).length === 0) return null;

    return Object.freeze({
        amount: amountRange.max,
        amountRange,
        minAmount: amountRange.min,
        fills
    });
}

// ─── Fluid container registry API ────────────────────────────────────────────
export function getFluidContainerRegistry() {
    return fluidContainerRegistry;
}

export function getFluidContainerDefinition(id) {
    if (typeof id !== "string" || id.length === 0) return null;
    return fluidContainerRegistry[id] ?? null;
}

export function registerFluidContainerDefinition(id, definition) {
    if (typeof id !== "string" || id.length === 0) return false;
    const normalized = normalizeFluidContainer(definition);
    if (!normalized) return false;
    fluidContainerRegistry[id] = normalized;
    return true;
}

export function registerFluidContainerBatch(entries) {
    if (!entries) return 0;

    const queue = [];

    if (Array.isArray(entries)) {
        queue.push(...entries);
    } else if (typeof entries === "object") {
        for (const [id, definition] of Object.entries(entries)) {
            if (definition && typeof definition === "object") {
                queue.push({ id, ...definition });
            }
        }
    } else {
        return 0;
    }

    let registered = 0;

    for (const entry of queue) {
        if (!entry || typeof entry !== "object") continue;

        const targets = [];
        const appendTarget = value => {
            if (typeof value === "string" && value.length > 0) {
                targets.push(value);
            }
        };

        appendTarget(entry.id);
        appendTarget(entry.item);
        appendTarget(entry.itemId);
        if (Array.isArray(entry.ids)) {
            for (const candidate of entry.ids) appendTarget(candidate);
        }

        const uniqueTargets = [...new Set(targets)];
        if (uniqueTargets.length === 0) continue;

        const normalized = normalizeFluidContainer(entry);
        if (!normalized) continue;

        for (const targetId of uniqueTargets) {
            if (registerFluidContainerDefinition(targetId, normalized)) {
                registered++;
            }
        }
    }

    return registered;
}

// ─── Fluid output registry API ───────────────────────────────────────────────
export function getFluidOutputRegistry() {
    return fluidOutputRegistry;
}

export function getFluidOutputDefinition(id) {
    if (typeof id !== "string" || id.length === 0) return null;
    return fluidOutputRegistry[id] ?? null;
}

export function registerFluidOutputDefinition(id, definition) {
    if (typeof id !== 'string' || id.length === 0) return false;
    const normalized = normalizeFluidOutput(definition);
    if (!normalized) return false;
    fluidOutputRegistry[id] = normalized;

    const required = normalized.amountRange?.max ?? normalized.amount;
    if (Number.isFinite(required) && required > 0) {
        fluidHolderRegistry[id] = {
            required,
            types: { ...normalized.fills }
        };
    }
    return true;
}

export function registerFluidOutputBatch(entries) {
    if (!entries) return 0;

    const queue = [];

    if (Array.isArray(entries)) {
        queue.push(...entries);
    } else if (typeof entries === 'object') {
        for (const [id, definition] of Object.entries(entries)) {
            if (definition && typeof definition === 'object') {
                queue.push({ id, ...definition });
            }
        }
    } else {
        return 0;
    }

    let registered = 0;

    for (const entry of queue) {
        if (!entry || typeof entry !== 'object') continue;

        const targets = [];
        const appendTarget = value => {
            if (typeof value === 'string' && value.length > 0) {
                targets.push(value);
            }
        };

        appendTarget(entry.id);
        appendTarget(entry.item);
        appendTarget(entry.itemId);
        if (Array.isArray(entry.ids)) {
            for (const candidate of entry.ids) appendTarget(candidate);
        }

        const uniqueTargets = [...new Set(targets)];
        if (uniqueTargets.length === 0) continue;

        const normalized = normalizeFluidOutput(entry);
        if (!normalized) continue;

        for (const targetId of uniqueTargets) {
            if (registerFluidOutputDefinition(targetId, normalized)) {
                registered++;
            }
        }
    }

    return registered;
}

// ─── Gas normalization helpers ───────────────────────────────────────────────
function normalizeGasContainer(definition) {
    if (!definition) return null;

    const amountRange = normalizeAmountRange(definition.amount);
    const type = sanitizeGasType(definition.type ?? definition.gas ?? definition.vapor);

    if (!amountRange || !type) return null;

    const normalized = {
        amount: amountRange.max,
        amountRange,
        minAmount: amountRange.min,
        type
    };

    if (definition.infinite === true) {
        normalized.infinite = true;
    }

    const output = definition.output ?? definition.result ?? definition.empty ?? definition.returnItem;
    if (typeof output === "string" && output.length > 0) {
        normalized.output = output;
    }

    return Object.freeze(normalized);
}

function normalizeGasOutput(definition) {
    if (!definition) return null;

    const amountRange = normalizeAmountRange(definition.amount ?? definition.requirement);
    if (!amountRange) return null;

    const rawFills = definition.fills ?? definition.outputs ?? definition.types;
    if (!rawFills || typeof rawFills !== "object") return null;

    const fills = {};
    for (const [rawType, itemId] of Object.entries(rawFills)) {
        const type = sanitizeGasType(rawType);
        if (!type) continue;
        if (typeof itemId !== "string" || itemId.length === 0) continue;
        fills[type] = itemId;
    }

    if (Object.keys(fills).length === 0) return null;

    return Object.freeze({
        amount: amountRange.max,
        amountRange,
        minAmount: amountRange.min,
        fills
    });
}

// ─── Gas container registry API ──────────────────────────────────────────────
export function getGasContainerRegistry() {
    return gasContainerRegistry;
}

export function getGasContainerDefinition(id) {
    if (typeof id !== "string" || id.length === 0) return null;
    return gasContainerRegistry[id] ?? null;
}

export function registerGasContainerDefinition(id, definition) {
    if (typeof id !== "string" || id.length === 0) return false;
    const normalized = normalizeGasContainer(definition);
    if (!normalized) return false;
    gasContainerRegistry[id] = normalized;
    return true;
}

export function registerGasContainerBatch(entries) {
    if (!entries) return 0;

    const queue = [];

    if (Array.isArray(entries)) {
        queue.push(...entries);
    } else if (typeof entries === "object") {
        for (const [id, definition] of Object.entries(entries)) {
            if (definition && typeof definition === "object") {
                queue.push({ id, ...definition });
            }
        }
    } else {
        return 0;
    }

    let registered = 0;

    for (const entry of queue) {
        if (!entry || typeof entry !== "object") continue;

        const targets = [];
        const appendTarget = value => {
            if (typeof value === "string" && value.length > 0) {
                targets.push(value);
            }
        };

        appendTarget(entry.id);
        appendTarget(entry.item);
        appendTarget(entry.itemId);
        if (Array.isArray(entry.ids)) {
            for (const candidate of entry.ids) appendTarget(candidate);
        }

        const uniqueTargets = [...new Set(targets)];
        if (uniqueTargets.length === 0) continue;

        const normalized = normalizeGasContainer(entry);
        if (!normalized) continue;

        for (const targetId of uniqueTargets) {
            if (registerGasContainerDefinition(targetId, normalized)) {
                registered++;
            }
        }
    }

    return registered;
}

// ─── Gas output registry API ─────────────────────────────────────────────────
export function getGasOutputRegistry() {
    return gasOutputRegistry;
}

export function getGasOutputDefinition(id) {
    if (typeof id !== "string" || id.length === 0) return null;
    return gasOutputRegistry[id] ?? null;
}

export function registerGasOutputDefinition(id, definition) {
    if (typeof id !== 'string' || id.length === 0) return false;
    const normalized = normalizeGasOutput(definition);
    if (!normalized) return false;
    gasOutputRegistry[id] = normalized;

    const required = normalized.amountRange?.max ?? normalized.amount;
    if (Number.isFinite(required) && required > 0) {
        gasHolderRegistry[id] = {
            required,
            types: { ...normalized.fills }
        };
    }
    return true;
}

export function registerGasOutputBatch(entries) {
    if (!entries) return 0;

    const queue = [];

    if (Array.isArray(entries)) {
        queue.push(...entries);
    } else if (typeof entries === 'object') {
        for (const [id, definition] of Object.entries(entries)) {
            if (definition && typeof definition === 'object') {
                queue.push({ id, ...definition });
            }
        }
    } else {
        return 0;
    }

    let registered = 0;

    for (const entry of queue) {
        if (!entry || typeof entry !== 'object') continue;

        const targets = [];
        const appendTarget = value => {
            if (typeof value === 'string' && value.length > 0) {
                targets.push(value);
            }
        };

        appendTarget(entry.id);
        appendTarget(entry.item);
        appendTarget(entry.itemId);
        if (Array.isArray(entry.ids)) {
            for (const candidate of entry.ids) appendTarget(candidate);
        }

        const uniqueTargets = [...new Set(targets)];
        if (uniqueTargets.length === 0) continue;

        const normalized = normalizeGasOutput(entry);
        if (!normalized) continue;

        for (const targetId of uniqueTargets) {
            if (registerGasOutputDefinition(targetId, normalized)) {
                registered++;
            }
        }
    }

    return registered;
}

// Backward-compatible aliases for legacy API names.
export const registerFluidContainerDefinitionBatch = registerFluidContainerBatch;
export const registerFluidOutputDefinitionBatch = registerFluidOutputBatch;
export const registerGasContainerDefinitionBatch = registerGasContainerBatch;
export const registerGasOutputDefinitionBatch = registerGasOutputBatch;

// ─── Internal utilities used by FluidManager ─────────────────────────────────
const resolveHolderRequirement = (holder) => {
    if (!holder || typeof holder !== "object") return 0;
    const candidate = holder.required ?? holder.amount ?? holder.minAmount;
    if (Number.isFinite(candidate)) return candidate;
    if (holder.amountRange?.max && Number.isFinite(holder.amountRange.max)) return holder.amountRange.max;
    return 0;
};

export function getFluidWhitelist(entity) {
    const allowed = [];
    if (!entity) return allowed;

    try {
        const whitelistTags = entity.getTags?.().filter(t => t.startsWith("fluidWhitelist:")) ?? [];
        for (const tag of whitelistTags) {
            const entry = tag.split(":")[1];
            if (entry) allowed.push(entry.toLowerCase());
        }
    } catch { /* ignore tag read errors */ }

    try {
        const rawProp = entity.getDynamicProperty?.("dorios:fluid_whitelist");
        if (typeof rawProp === "string" && rawProp.length) {
            for (const token of rawProp.split(",")) {
                const trimmed = token.trim().toLowerCase();
                if (trimmed) allowed.push(trimmed);
            }
        }
    } catch { /* ignore missing dynamic property */ }

    return allowed;
}

export function entityAllowsFluid(entity, type) {
    const allowed = getFluidWhitelist(entity);
    if (!allowed.length) return true;
    const normalized = typeof type === "string" ? type.toLowerCase() : "";
    if (!normalized) return false;
    return allowed.includes(normalized);
}

// ─── Direction utility used by FluidManager.transferFluids ───────────────────
import {
    CARDINAL_DIRECTION_OFFSETS,
    OPPOSITE_DIRECTIONS,
} from "../constants.js";

const FLUID_STORAGE_DIRECTIONS = Object.freeze({
    leftOf: Object.freeze({
        north: "west",
        south: "east",
        east: "north",
        west: "south"
    }),
    rightOf: Object.freeze({
        north: "east",
        south: "west",
        east: "south",
        west: "north"
    }),
    validRelative: new Set(["front", "back", "left", "right", "up", "down"])
});

const LEFT_OF_DIRECTION = FLUID_STORAGE_DIRECTIONS.leftOf;
const RIGHT_OF_DIRECTION = FLUID_STORAGE_DIRECTIONS.rightOf;
const VALID_RELATIVE_DIRECTIONS = FLUID_STORAGE_DIRECTIONS.validRelative;

const cloneOffsetVector = (vector) => ({ x: vector.x, y: vector.y, z: vector.z });

function normalizeCustomOffset(offset) {
    if (!offset || typeof offset !== "object") return null;
    const x = Number(offset.x);
    const y = Number(offset.y);
    const z = Number(offset.z);
    if (![x, y, z].every(Number.isFinite)) return null;
    return { x, y, z };
}

function resolveRelativeDirection(baseDirection, relative) {
    if (!relative || !VALID_RELATIVE_DIRECTIONS.has(relative)) return null;

    if (!baseDirection && ["front", "back", "left", "right"].includes(relative)) {
        return null;
    }

    switch (relative) {
        case "front":
            return baseDirection;
        case "back":
            return OPPOSITE_DIRECTIONS[baseDirection];
        case "left":
            return LEFT_OF_DIRECTION[baseDirection] ?? null;
        case "right":
            return RIGHT_OF_DIRECTION[baseDirection] ?? null;
        case "up":
            return "up";
        case "down":
            return "down";
        default:
            return null;
    }
}

function resolveDirectionVector(direction) {
    if (!direction) return null;
    const key = direction.toLowerCase();
    const vector = CARDINAL_DIRECTION_OFFSETS[key];
    return vector ? cloneOffsetVector(vector) : null;
}

export function resolveFluidTransferOffset(facing, options) {
    if (!options) options = {};

    const customOffset = normalizeCustomOffset(options.offset);
    if (customOffset) return customOffset;

    let direction = options.direction;
    if (direction) {
        return resolveDirectionVector(direction);
    }

    if (options.relative) {
        const relativeDirection = resolveRelativeDirection(facing, options.relative);
        if (relativeDirection) {
            return resolveDirectionVector(relativeDirection);
        }
    }

    const fallbackDirection = options.useFacing ? facing : OPPOSITE_DIRECTIONS[facing];
    return resolveDirectionVector(fallbackDirection);
}

// ─── Fluid objectives ────────────────────────────────────────────────────────
const fluidObjectives = new Map();

const fluidDisplayItemPrefixes = new Map([
    ["liquified_aetherium", "utilitycraft:liquified_aetherium"],
    ["dark_matter", "utilitycraft:dark_matter"],
    ["cryofluid", "utilitycraft:cryofluid"],
    ["steam", "utilitycraft:steam"],
]);

function initFluidObjectives(index = 0) {
    const definitions = [
        [`fluid_${index}`, `fluid ${index}`],
        [`fluidExp_${index}`, `fluid Exp ${index}`],
        [`fluidCap_${index}`, `fluid Cap ${index}`],
        [`fluidCapExp_${index}`, `fluid Cap Exp ${index}`]
    ];

    for (const [id, display] of definitions) {
        if (!fluidObjectives.has(id)) {
            let obj = world.scoreboard.getObjective(id);
            if (!obj) obj = world.scoreboard.addObjective(id, display);
            fluidObjectives.set(id, obj);
        }
    }
}


/**
 * Manages scoreboard-based fluid values for entities or machines.
 */
export class FluidManager {
    constructor(entity, index = 0) {
        this.entity = entity;
        this.index = index;

        initFluidObjectives(index);

        this.scoreId = entity?.scoreboardIdentity;
        if (!this.scoreId && entity) {
            try {
                entity.runCommand(`scoreboard players add @s fluid_${index} 0`);
                this.scoreId = entity.scoreboardIdentity;
            } catch (error) {
                console.warn(`[UtilityCraft/FluidManager] Failed to seed fluid scoreboard for ${entity.typeId ?? 'unknown'}`, error);
            }
        }

        if (!this.scoreId) {
            throw new Error("FluidManager requires an entity with a scoreboard identity.");
        }

        this.scores = {
            fluid: fluidObjectives.get(`fluid_${index}`),
            fluidExp: fluidObjectives.get(`fluidExp_${index}`),
            fluidCap: fluidObjectives.get(`fluidCap_${index}`),
            fluidCapExp: fluidObjectives.get(`fluidCapExp_${index}`)
        };

        this.type = this.getType();
        this.cap = this.getCap();
        if (this.get() == 0) this.setType('empty')
    }

    static initializeSingle(entity) {
        initFluidObjectives(0);
        return new FluidManager(entity, 0);
    }

    static initializeMultiple(entity, maxIndex) {
        const tanks = [];
        for (let i = 0; i < maxIndex; i++) {
            initFluidObjectives(i);
            tanks.push(new FluidManager(entity, i));
        }
        return tanks;
    }

    static findType(entity, index = 0) {
        if (!entity?.isValid) return null;
        try {
            const fm = new FluidManager(entity, index);
            if (fm.getCap() > 0) return fm;
        } catch {
            // Entity doesn't have scoreboard identity or fluid objectives
        }
        return null;
    }

    static get itemFluidContainers() {
        return getFluidContainerRegistry();
    }

    static registerFluidContainer(id, definition) {
        return registerFluidContainerDefinition(id, definition);
    }

    static get fluidOutputContainers() {
        return getFluidOutputRegistry();
    }

    static getFluidFillDefinition(id) {
        if (!id) return null;
        return getFluidOutputDefinition(id);
    }

    static registerFluidOutput(id, definition) {
        return registerFluidOutputDefinition(id, definition);
    }

    static registerFluidDisplay(type, itemPrefix) {
        if (typeof type !== "string" || type.length === 0) return false;
        if (typeof itemPrefix !== "string" || itemPrefix.length === 0) return false;
        fluidDisplayItemPrefixes.set(type.toLowerCase(), itemPrefix);
        return true;
    }

    static getDisplayItemId(type, frameSuffix) {
        const key = typeof type === "string" ? type.toLowerCase() : "";
        const fallbackPrefix = key ? `utilitycraft:${key}` : "utilitycraft:fluid";
        const prefix = fluidDisplayItemPrefixes.get(key) ?? fallbackPrefix;
        return `${prefix}_${frameSuffix}`;
    }

    static getItemLore(item) {
        if (!item || typeof item.getLore !== "function") return [];
        const lore = item.getLore();
        return Array.isArray(lore) ? lore : [];
    }

    static shouldReplaceDisplayItem(current, next) {
        if (!current) return true;
        if (!next) return current !== undefined;
        if (current.typeId !== next.typeId) return true;
        if ((current.amount ?? 1) !== (next.amount ?? 1)) return true;
        if ((current.nameTag ?? "") !== (next.nameTag ?? "")) return true;

        const currentLore = FluidManager.getItemLore(current);
        const nextLore = FluidManager.getItemLore(next);
        if (currentLore.length !== nextLore.length) return true;
        for (let index = 0; index < currentLore.length; index++) {
            if (currentLore[index] !== nextLore[index]) return true;
        }

        return false;
    }

    // ─── Normalization utilities ─────────────────────────────────────────────

    static normalizeValue(amount) {
        let exp = 0;
        let value = amount;
        while (value > 1e9) {
            value /= 1000;
            exp += 3;
        }
        return { value: Math.floor(value), exp };
    }

    static combineValue(value, exp) {
        return (value || 0) * (10 ** (exp || 0));
    }

    static formatFluid(value) {
        let unit = "mB";
        let decimals = 1;

        if (value >= 1000) {
            let bucketValue = value / 1000;
            const units = ["B", "KB", "MB", "GB", "TB", "PB"];
            let unitIndex = 0;

            while (bucketValue >= 1000 && unitIndex < units.length - 1) {
                bucketValue /= 1000;
                unitIndex += 1;
            }

            unit = units[unitIndex];
            value = bucketValue;
            decimals = unitIndex >= 2 ? 2 : 1;
        }
        return `${value.toFixed(decimals)} ${unit}`;
    }

    static getFluidFromText(input) {
        const cleaned = input.replace(/§./g, "").trim();

        const match = cleaned.match(/([^:]+):\s*([\d.]+)\s*(mB|B|KB|MB|GB|TB|PB)/i);
        if (!match) return { type: "empty", amount: 0 };

        const [, rawType, rawValue, rawUnit] = match;
        const unit = typeof rawUnit === "string"
            ? (rawUnit.toLowerCase() === "mb" && rawUnit !== "MB" ? "mB" : rawUnit.toUpperCase())
            : "mB";

        const multipliers = {
            mB: 1,
            B: 1_000,
            KB: 1_000_000,
            MB: 1_000_000_000,
            GB: 1_000_000_000_000,
            TB: 1_000_000_000_000_000,
            PB: 1_000_000_000_000_000_000
        };

        const amount = parseFloat(rawValue) * (multipliers[unit] ?? 1);
        const cleanedType = typeof rawType === "string" ? rawType.trim() : "";
        const normalizedType = sanitizeFluidType(cleanedType.replace(/\s+/g, "_"));
        const type = normalizedType || "empty";

        return { type, amount };
    }

    static getContainerData(id) {
        if (!id) return null;
        return getFluidContainerDefinition(id);
    }

    // ─── Core operations ─────────────────────────────────────────────────────

    static initialize(entity) {
        entity.runCommand(`scoreboard players set @s fluid_0 0`);
    }

    static transferBetween(dim, sourceLoc, targetLoc, amount = 100) {
        if (!dim || !sourceLoc || !targetLoc) return false;

        const sourceBlock = dim.getBlock(sourceLoc);
        const targetBlock = dim.getBlock(targetLoc);

        if (!sourceBlock?.hasTag("dorios:fluid")) return false;
        if (!targetBlock?.hasTag("dorios:fluid")) return false;

        const sourceEntity = dim.getEntitiesAtBlockLocation(sourceLoc)[0];
        if (!sourceEntity) return false;
        if (sourceEntity.hasTag?.("dorios:fluid_input_only")) return false;

        const sourceFluid = new FluidManager(sourceEntity, 0);
        if (!sourceFluid || sourceFluid.get() <= 0) return false;

        let targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];

        if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
            const type = sourceFluid.getType();
            if (type == 'empty') return false
            targetEntity = FluidManager.addfluidToTank(targetBlock, type, 0);
        }

        if (!targetEntity) return false;

        if (!entityAllowsFluid(targetEntity, sourceFluid.getType())) return false;

        const targetFluid = new FluidManager(targetEntity, 0);
        if (!targetFluid || targetFluid.getCap() <= 0) return false;

        const transferred = sourceFluid.transferTo(targetFluid, amount);
        return transferred > 0;
    }

    tryInsert(type, amount) {
        if (amount <= 0) return false;
        if (!entityAllowsFluid(this.entity, type)) return false;
        const currentType = this.getType();
        if (currentType === "empty" || currentType === type) {
            if (amount <= this.getFreeSpace()) {
                if (currentType === "empty") this.setType(type);
                this.add(amount);
                return true;
            }
        }
        return false;
    }

    fluidItem(typeId) {
        const insertData = FluidManager.getContainerData(typeId);
        if (insertData) {
            const { type, output } = insertData;
            if (insertData.infinite === true) {
                if (!entityAllowsFluid(this.entity, type)) return false;

                const currentType = this.getType();
                if (currentType !== "empty" && currentType !== type) return false;

                let cap = this.getCap();
                let effectiveCap = cap;
                if (!Number.isFinite(effectiveCap) || effectiveCap <= 0) {
                    effectiveCap = FLUID_STORAGE_DEFAULTS.infiniteFluidCapFallback;
                    try {
                        this.setCap(effectiveCap);
                    } catch { /* ignore cap reset errors */ }
                }

                const current = this.get();
                const freeSpace = Math.max(0, effectiveCap - current);
                if (freeSpace <= 0) return false;

                if (currentType === "empty") this.setType(type);
                this.add(freeSpace);
                return output ?? typeId;
            }

            const insertAmount = insertData.amountRange?.max ?? insertData.amount;

            const inserted = this.tryInsert(type, insertAmount);
            if (!inserted) return false;

            return output;
        }

        const holder = fluidHolderRegistry[typeId];
        if (holder) {
            const storedType = this.getType();
            if (!storedType || storedType === 'empty') return false;

            const outputItemId = holder.types?.[storedType];
            if (!outputItemId) return false;

            const required = resolveHolderRequirement(holder);
            if (required <= 0 || this.get() < required) return false;

            this.add(-required);
            if (this.get() <= 0) this.setType('empty');
            return outputItemId;
        }

        const fillDefinition = FluidManager.getFluidFillDefinition(typeId);
        if (fillDefinition) {
            const storedType = this.getType();
            if (!storedType || storedType === 'empty') return false;

            const filledItemId = fillDefinition.fills?.[storedType];
            if (!filledItemId) return false;
            const drainAmount = fillDefinition.amountRange?.max ?? fillDefinition.amount;
            if (this.get() < drainAmount) return false;

            this.add(-drainAmount);
            if (this.get() <= 0) this.setType('empty');
            return filledItemId;
        }

        return false;
    }

    setCap(amount) {
        const { value, exp } = FluidManager.normalizeValue(amount);
        this.scores.fluidCap.setScore(this.scoreId, value);
        this.scores.fluidCapExp.setScore(this.scoreId, exp);
    }

    getCap() {
        const v = this.scores.fluidCap.getScore(this.scoreId) || 0;
        const e = this.scores.fluidCapExp.getScore(this.scoreId) || 0;
        this.cap = FluidManager.combineValue(v, e);
        return this.cap;
    }

    set(amount) {
        const { value, exp } = FluidManager.normalizeValue(amount);
        this.scores.fluid.setScore(this.scoreId, value);
        this.scores.fluidExp.setScore(this.scoreId, exp);
        if (this.entity?.typeId?.startsWith("utilitycraft:fluid_tank")) {
            this.entity.setHealth(amount);
        }
    }

    get() {
        const v = this.scores.fluid.getScore(this.scoreId) || 0;
        const e = this.scores.fluidExp.getScore(this.scoreId) || 0;
        return FluidManager.combineValue(v, e);
    }

    add(amount) {
        if (amount === 0) return 0;

        const free = this.getFreeSpace();
        if (amount > 0 && free <= 0) return 0;
        if (amount > free) amount = free;

        let value = this.scores.fluid.getScore(this.scoreId) || 0;
        let exp = this.scores.fluidExp.getScore(this.scoreId) || 0;
        const multi = 10 ** exp;

        const normalizedAdd = Math.floor(amount / multi);

        let newValue = value + normalizedAdd;
        if (Math.abs(newValue) <= 1e9) {
            this.scores.fluid.addScore(this.scoreId, normalizedAdd);

            if (exp > 0 && value < 1e6) {
                this.set(this.get() + amount);
            }
        } else {
            this.set(this.get() + amount);
        }

        if (this.entity?.typeId?.startsWith("utilitycraft:fluid_tank")) {
            const amountCurrent = this.get()
            if (amountCurrent > 0) {
                system.run(() => {
                    this.entity.setHealth(amountCurrent);
                })
            } else { this.entity.remove() }
        }

        return amount;
    }

    consume(amount) {
        if (this.entity?.hasTag?.("creative")) return amount;

        const current = this.get();
        if (current < amount) return 0;
        this.add(-amount);
        return amount;
    }

    getFreeSpace() {
        return Math.max(0, this.getCap() - this.get());
    }

    has(amount) {
        return this.get() >= amount;
    }

    isFull() {
        return this.get() >= this.getCap();
    }

    // ─── Type tag management ─────────────────────────────────────────────────

    getType() {
        const tag = this.entity.getTags().find(t => t.startsWith(`fluid${this.index}Type:`));
        return tag ? tag.split(":")[1] : "empty";
    }

    setType(type) {
        const old = this.entity.getTags().find(t => t.startsWith(`fluid${this.index}Type:`));
        if (old) this.entity.removeTag(old);
        this.entity.addTag(`fluid${this.index}Type:${type}`);
        this.type = type;
    }

    // ─── Transfer operations ─────────────────────────────────────────────────

    transferToNetwork(speed, mode = "nearest", nodes) {
        if (this.entity?.hasTag?.("dorios:fluid_input_only")) return 0;
        if (!Array.isArray(nodes) || nodes.length === 0) {
            try {
                const cached = this.entity.getDynamicProperty("dorios:fluid_nodes");
                if (cached) {
                    nodes = JSON.parse(cached);
                }
            } catch { /* ignore */ }
            if (!Array.isArray(nodes) || nodes.length === 0) return 0;
        }

        const dim = this.entity.dimension;
        const pos = this.entity.location;
        let available = this.get();
        if (available <= 0 || speed <= 0) return 0;

        let transferred = 0;
        const type = this.getType();
        if (!type || type === "empty") return 0;

        let orderedTargets = [...nodes];

        const canReceiveNode = (node) => {
            const role = node?.role ?? "direct";
            return role === "sink" || role === "direct";
        };

        const nodeEnabled = (node) => node?.enabled !== false;

        const nodeMatchesType = (node, fluidType) => {
            const filters = Array.isArray(node?.filters)
                ? node.filters.map(entry => String(entry).toLowerCase()).filter(Boolean)
                : [];
            if (filters.length === 0) return true;

            const normalizedType = String(fluidType).toLowerCase();
            const contains = filters.includes(normalizedType);
            return node?.filterMode === "blacklist" ? !contains : contains;
        };

        const processTarget = (node, share = null) => {
            if (!Number.isFinite(node?.x) || !Number.isFinite(node?.y) || !Number.isFinite(node?.z)) return 0;
            if (!canReceiveNode(node)) return 0;
            if (!nodeEnabled(node)) return 0;
            if (!nodeMatchesType(node, type)) return 0;

            const loc = { x: node.x, y: node.y, z: node.z };
            const targetBlock = dim.getBlock(loc);
            if (!targetBlock?.hasTag("dorios:fluid")) return 0;

            let targetEntity = dim.getEntitiesAtBlockLocation(loc)[0];
            if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
                FluidManager.addfluidToTank(targetBlock, type, 0);
                targetEntity = dim.getEntitiesAtBlockLocation(loc)[0];
            }
            if (!targetEntity) return 0;
            if (!entityAllowsFluid(targetEntity, type)) return 0;

            const target = FluidManager.findType(targetEntity, 0);
            if (!target) return 0;

            const targetType = target.getType();
            const space = target.getFreeSpace();

            if (targetType !== "empty" && targetType !== type) return 0;
            if (space <= 0) return 0;

            if (targetType === "empty") target.setType(type);

            const amount = share ? Math.min(share, space, available, speed) : Math.min(space, available, speed);
            const added = target.add(amount);

            if (added > 0) {
                available -= added;
                speed -= added;
                transferred += added;
            }

            return added;
        };

        if (mode === "round") {
            const share = Math.floor(speed / orderedTargets.length);
            for (const loc of orderedTargets) {
                if (available <= 0 || speed <= 0) break;
                processTarget(loc, share);
            }
        } else {
            for (const loc of orderedTargets) {
                if (available <= 0 || speed <= 0) break;
                processTarget(loc);
            }
        }

        if (transferred > 0) this.add(-transferred);

        return transferred;
    }

    transferFluids(block, amount = 100, options = undefined) {
        if (!block || !this.entity?.isValid) return false;
        if (this.entity?.hasTag?.("dorios:fluid_input_only")) return false;

        const opts = options ?? {};
        const requireTube = opts.requireTube ?? block.hasTag("dorios:isTube");
        if (requireTube && !block.hasTag("dorios:isTube")) return false;

        const facing = block.getState("utilitycraft:axis");
        const offset = resolveFluidTransferOffset(facing, opts);
        if (!offset) return false;

        const targetTag = opts.targetTag ?? "dorios:fluid";
        const targetIndex = Number.isInteger(opts.targetIndex) ? opts.targetIndex : 0;

        const { x, y, z } = block.location;
        const targetLoc = { x: x + offset.x, y: y + offset.y, z: z + offset.z };
        const dim = block.dimension;
        const targetBlock = dim.getBlock(targetLoc);
        if (!targetBlock) return false;

        if (targetTag && !targetBlock.hasTag(targetTag)) return false;

        let targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];

        if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
            const type = this.getType();
            if (type === 'empty') return false;
            FluidManager.addfluidToTank(targetBlock, type, 0);
            targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];
        }

        if (!targetEntity) return false;

        const sourceType = this.getType();
        if (!entityAllowsFluid(targetEntity, sourceType)) return false;

        const targetFluid = new FluidManager(targetEntity, targetIndex);
        if (!targetFluid || targetFluid.getCap() <= 0) return false;

        const transferred = this.transferTo(targetFluid, amount);
        return transferred > 0;
    }

    transferTo(other, amount) {
        if (this.entity?.hasTag?.("dorios:fluid_input_only")) return 0;
        const sourceType = this.getType();
        if (!entityAllowsFluid(other?.entity, sourceType)) return 0;
        if (sourceType !== other.getType() && other.getType() !== "empty") return 0;

        const transferable = Math.min(amount, this.get(), other.getFreeSpace());
        if (transferable <= 0) return 0;

        this.add(-transferable);
        other.add(transferable);
        if (other.getType() === "empty") other.setType(sourceType);
        return transferable;
    }

    receiveFrom(other, amount) {
        return other.transferTo(this, amount);
    }

    // ─── Display logic ───────────────────────────────────────────────────────

    display(slot = 4, options = {}) {
        const inv = this.entity.getComponent("minecraft:inventory")?.container;
        if (!inv) return;
        if (!shouldRefreshEntityUi(this.entity, `fluid:${slot}`, options.interval, options.force === true)) return;

        const fluid = this.get();
        const cap = this.getCap();
        const type = this.getType();

        if (type === "empty") {
            let emptyBar = new ItemStack("utilitycraft:empty_fluid_bar")
            emptyBar.nameTag = '§rEmpty'
            const current = inv.getItem(slot)
            if (!FluidManager.shouldReplaceDisplayItem(current, emptyBar)) return
            inv.setItem(slot, emptyBar)
            return;
        }

        const safeCap = Math.max(1, cap || 1);
        const normalizedFluid = Math.max(0, Math.min(fluid, safeCap));
        const fillRatio = normalizedFluid / safeCap;
        const frame = Math.max(0, Math.min(48, Math.floor(fillRatio * 48)));
        const frameName = frame.toString().padStart(2, "0");
        const itemId = FluidManager.getDisplayItemId(type, frameName);
        const percentFilled = fillRatio * 100;

        let item;
        try {
            item = new ItemStack(itemId, 1);
        } catch {
            item = new ItemStack("utilitycraft:empty_fluid_bar", 1);
        }
        item.nameTag = `§r${DoriosAPI.utils.formatIdToText(type)}
    §r§7  Stored: ${FluidManager.formatFluid(fluid)} / ${FluidManager.formatFluid(cap)}
    §r§7  Percentage: ${percentFilled.toFixed(2)}%`;

        const current = inv.getItem(slot)
        if (!FluidManager.shouldReplaceDisplayItem(current, item)) return

        inv.setItem(slot, item);
    }

    // ─── Tank utility ────────────────────────────────────────────────────────

    static addfluidToTank(block, type, amount) {
        const dim = block.dimension;
        const pos = block.location;
        let entity = dim.getEntitiesAtBlockLocation(pos)[0];

        if (!entity) {
            const { x, y, z } = block.location;
            entity = dim.spawnEntity(`utilitycraft:fluid_tank_${type}`, { x: x + 0.5, y, z: z + 0.5 });
            if (!entity) return false;
            FluidManager.initialize(entity);
            entity.triggerEvent(`${block.typeId.split('_')[0]}`)
        }

        const tank = new FluidManager(entity, 0);
        tank.setCap(FluidManager.getTankCapacity(block.typeId));
        tank.setType(type);
        tank.add(amount);
        return entity;
    }

    static getTankCapacity(typeId) {
        const caps = {
            "utilitycraft:basic_fluid_tank": 8000,
            "utilitycraft:advanced_fluid_tank": 32000,
            "utilitycraft:expert_fluid_tank": 128000,
            "utilitycraft:ultimate_fluid_tank": 512000
        };
        return caps[typeId] ?? 8000;
    }
}

/**
 * Backward-compatible shim for legacy gas APIs.
 */
export class GasManager extends FluidManager {
    static initializeSingle(entity) {
        return new GasManager(entity, 0);
    }

    static initializeMultiple(entity, maxIndex) {
        const tanks = [];
        for (let i = 0; i < maxIndex; i++) {
            tanks.push(new GasManager(entity, i));
        }
        return tanks;
    }

    static findType(entity, index = 0) {
        if (!entity?.isValid) return null;
        try {
            const gm = new GasManager(entity, index);
            if (gm.getCap() > 0) return gm;
        } catch {
        }
        return null;
    }

    static initialize(entity) {
        return FluidManager.initialize(entity);
    }

    static normalizeValue(amount) {
        return FluidManager.normalizeValue(amount);
    }

    static combineValue(value, exp) {
        return FluidManager.combineValue(value, exp);
    }

    static formatGas(value) {
        return FluidManager.formatFluid(value);
    }

    static getGasFromText(input) {
        if (typeof input !== "string") return { type: "empty", amount: 0 };

        const cleaned = input.replace(/§./g, "").trim();
        const match = cleaned.match(/Gas\s*(?:\(([^)]+)\))?:\s*([\d.]+)\s*(mB|B|KB|MB|GB|TB|PB)/i);
        if (match) {
            const [, rawType, rawValue, rawUnit] = match;
            const unit = typeof rawUnit === "string"
                ? (rawUnit.toLowerCase() === "mb" && rawUnit !== "MB" ? "mB" : rawUnit.toUpperCase())
                : "mB";

            const multipliers = {
                mB: 1,
                B: 1_000,
                KB: 1_000_000,
                MB: 1_000_000_000,
                GB: 1_000_000_000_000,
                TB: 1_000_000_000_000_000,
                PB: 1_000_000_000_000_000_000
            };

            const amount = parseFloat(rawValue) * (multipliers[unit] ?? 1);
            const cleanedType = typeof rawType === "string" ? rawType.trim() : "";
            const normalizedType = sanitizeGasType(cleanedType.replace(/\s+/g, "_"));
            return { type: normalizedType || "empty", amount };
        }

        return FluidManager.getFluidFromText(input);
    }

    static get itemGasContainers() {
        return FluidManager.itemFluidContainers;
    }

    static registerGasContainer(id, definition) {
        return FluidManager.registerFluidContainer(id, definition);
    }

    static get gasOutputContainers() {
        return FluidManager.fluidOutputContainers;
    }

    static getGasFillDefinition(id) {
        return FluidManager.getFluidFillDefinition(id);
    }

    static registerGasOutput(id, definition) {
        return FluidManager.registerFluidOutput(id, definition);
    }

    static registerGasDisplay(type, itemPrefix) {
        return FluidManager.registerFluidDisplay(type, itemPrefix);
    }

    static getDisplayItemId(type, frameSuffix) {
        return FluidManager.getDisplayItemId(type, frameSuffix);
    }

    static getContainerData(id) {
        return FluidManager.getContainerData(id);
    }

    gasItem(typeId) {
        return this.fluidItem(typeId);
    }

    transferGases(block, amount = 100, options = undefined) {
        return this.transferFluids(block, amount, {
            ...(options ?? {}),
            targetTag: options?.targetTag ?? "dorios:fluid"
        });
    }
}

// Expose holder map to mirror upstream API shape
FluidManager.itemFluidHolders = fluidHolderRegistry;
GasManager.itemGasHolders = fluidHolderRegistry;
