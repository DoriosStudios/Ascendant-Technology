// @ts-check

import { EnchantmentTypes } from "@minecraft/server";

const ENCHANTABLE_COMPONENT_ID = "minecraft:enchantable";
const STORED_TARGETS_KEY = "utilitycraft:ascane_enchant_plan";

const MODULES = new Map([
    ["utilitycraft:enchantability_module", ["enchantability", 1]],
    ["utilitycraft:enchantability_module_2", ["enchantability", 2]],
    ["utilitycraft:enchantability_module_3", ["enchantability", 3]],
    ["utilitycraft:enchantability_module_4", ["enchantability", 4]],
    ["utilitycraft:enchantability_module_5", ["enchantability", 5]],
    ["utilitycraft:reinforcement_module", ["reinforcement", 1]],
    ["utilitycraft:reinforcement_module_2", ["reinforcement", 2]],
    ["utilitycraft:reinforcement_module_3", ["reinforcement", 3]],
    ["utilitycraft:curse_protection_module", ["curseProtection", 1]],
]);

const TARGET_MAX_LEVELS = [5, 4, 3, 2, 1];
const TARGET_LEVELS = [
    [1, 1, 1, 0, 0],
    [2, 2, 1, 0, 0],
    [3, 2, 2, 1, 0],
    [4, 3, 2, 2, 0],
    [5, 4, 3, 2, 1],
];

const CURSE_IDS = new Set([
    "minecraft:binding",
    "minecraft:vanishing",
]);

// Entries in the same group compete for one weighted source, matching the
// station's legacy enchant pool without repeatedly rebuilding it at runtime.
const ENCHANTMENT_SOURCES = [
    ["minecraft:protection", "minecraft:fire_protection", "minecraft:blast_protection", "minecraft:projectile_protection"],
    ["minecraft:sharpness", "minecraft:smite", "minecraft:bane_of_arthropods", "minecraft:density"],
    ["minecraft:silk_touch", "minecraft:fortune"],
    ["minecraft:depth_strider", "minecraft:frost_walker"],
    ["minecraft:multishot", "minecraft:piercing", "minecraft:breach"],
    ["minecraft:loyalty", "minecraft:riptide"],
    ["minecraft:unbreaking"],
    ["minecraft:mending"],
    ["minecraft:efficiency"],
    ["minecraft:respiration"],
    ["minecraft:aqua_affinity"],
    ["minecraft:thorns"],
    ["minecraft:feather_falling"],
    ["minecraft:fire_aspect"],
    ["minecraft:knockback"],
    ["minecraft:looting"],
    ["minecraft:power"],
    ["minecraft:punch"],
    ["minecraft:flame"],
    ["minecraft:infinity"],
    ["minecraft:quick_charge"],
    ["minecraft:impaling"],
    ["minecraft:channeling"],
    ["minecraft:lure"],
    ["minecraft:luck_of_the_sea"],
    ["minecraft:soul_speed"],
    ["minecraft:swift_sneak"],
    ["minecraft:wind_burst"],
    ["minecraft:lunge"],
];

/** @type {Map<string, import("@minecraft/server").EnchantmentType> | undefined} */
let enchantmentsById;

/**
 * Resolves the highest module tier of each family from the three station slots.
 * Every lookup is exact and O(1).
 *
 * @param {import("@minecraft/server").Container} container
 * @param {number[]} slots
 * @returns {StationModules}
 */
export function resolveStationModules(container, slots) {
    const result = { enchantability: 0, reinforcement: 0, curseProtection: 0 };

    for (let index = 0; index < slots.length; index++) {
        const item = container.getItem(slots[index]);
        const definition = MODULES.get(item?.typeId ?? "");
        if (!definition) continue;

        const [type, level] = definition;
        if (type === "enchantability") result.enchantability = Math.max(result.enchantability, level);
        else if (type === "reinforcement") result.reinforcement = Math.max(result.reinforcement, level);
        else result.curseProtection = Math.max(result.curseProtection, level);
    }

    return result;
}

/** @param {StationModules} modules */
export function createStationModuleSignature(modules) {
    return `e${modules.enchantability}|r${modules.reinforcement}|c${modules.curseProtection}`;
}

/**
 * @param {import("@minecraft/server").ItemStack} stack
 * @returns {string}
 */
export function createStationEnchantSignature(stack) {
    return readEnchantments(stack)
        .map((entry) => `${entry.id}@${entry.level}`)
        .sort()
        .join(",");
}

/**
 * Builds and locks a plan only when the caller detects a changed item/module
 * signature. Catalog lookups are cached and compatibility is tested on a
 * disposable clone that includes every previously selected enchantment.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {StationModules} modules
 * @returns {{ plan: StationEnchantPlan, storedTargetsChanged: boolean }}
 */
export function buildStationEnchantPlan(stack, modules) {
    const enchantable = getEnchantable(stack);
    if (!enchantable) {
        return { plan: emptyPlan(), storedTargetsChanged: false };
    }

    const current = readEnchantments(stack);
    const curated = modules.curseProtection > 0
        ? current.filter((entry) => !CURSE_IDS.has(entry.id))
        : current.slice();
    const curatingChanged = curated.length !== current.length;

    if (modules.enchantability <= 0) {
        return {
            plan: {
                version: 1,
                changed: curatingChanged,
                enchantingChanged: false,
                curatingChanged,
                changeCount: 0,
                enchantments: curated.map(({ id, level }) => ({ id, level })),
            },
            storedTargetsChanged: false,
        };
    }

    const working = stack.clone();
    if (!replaceEnchantments(working, curated)) {
        return { plan: emptyPlan(), storedTargetsChanged: false };
    }
    const workingEnchantable = getEnchantable(working);
    if (!workingEnchantable) return { plan: emptyPlan(), storedTargetsChanged: false };

    const result = curated.map((entry) => ({ id: entry.id, level: entry.level }));
    const resultIds = new Set(result.map((entry) => entry.id));

    for (let index = 0; index < result.length; index++) {
        const entry = result[index];
        const type = getEnchantmentsById().get(entry.id);
        if (!type) continue;
        entry.level = Math.max(entry.level, getTargetLevel(modules.enchantability, type.maxLevel));
    }

    const stored = readStoredTargets(stack);
    const storedMatchesTier = stored?.moduleLevel === modules.enchantability;
    const storedTargets = storedMatchesTier
        ? stored.ids.filter((id) => modules.curseProtection <= 0 || !CURSE_IDS.has(id))
        : [];
    for (const id of resultIds) {
        if (!storedTargets.includes(id)) storedTargets.push(id);
    }

    let storedTargetsChanged = !storedMatchesTier
        || storedTargets.length !== (stored?.ids.length ?? 0)
        || !Number.isFinite(stored?.curseRoll);
    const curseRoll = storedMatchesTier && Number.isFinite(stored?.curseRoll)
        ? stored.curseRoll
        : Math.random();
    const desiredCount = Math.max(1, modules.enchantability);
    const sourcePool = buildSourcePool(workingEnchantable);

    while (storedTargets.length < desiredCount && sourcePool.length > 0) {
        const sourceIndex = Math.floor(Math.random() * sourcePool.length);
        const source = sourcePool[sourceIndex];
        const available = source.filter((id) => !storedTargets.includes(id));
        if (available.length === 0) {
            sourcePool.splice(sourceIndex, 1);
            continue;
        }

        const id = available[Math.floor(Math.random() * available.length)];
        storedTargets.push(id);
        storedTargetsChanged = true;
    }

    for (let index = 0; index < storedTargets.length && result.length < desiredCount; index++) {
        const id = storedTargets[index];
        if (resultIds.has(id)) continue;

        const type = getEnchantmentsById().get(id);
        if (!type) continue;
        const level = getTargetLevel(modules.enchantability, type.maxLevel);
        if (level <= 0 || !canAdd(workingEnchantable, type, level)) continue;

        try {
            workingEnchantable.addEnchantment({ type, level });
        } catch {
            continue;
        }
        result.push({ id, level });
        resultIds.add(id);
    }

    if (modules.curseProtection <= 0 && curseRoll <= Math.max(0, 0.15 - modules.enchantability * 0.01)) {
        for (const curseId of CURSE_IDS) {
            if (resultIds.has(curseId)) continue;
            const type = getEnchantmentsById().get(curseId);
            if (!type || !canAdd(workingEnchantable, type, 1)) continue;
            result.push({ id: curseId, level: 1 });
            resultIds.add(curseId);
            break;
        }
    }

    if (storedTargetsChanged) {
        writeStoredTargets(stack, { moduleLevel: modules.enchantability, ids: storedTargets, curseRoll });
    }

    const changeCount = countPositiveChanges(curated, result);
    const enchantingChanged = changeCount > 0;

    return {
        plan: {
            version: 1,
            changed: curatingChanged || enchantingChanged,
            enchantingChanged,
            curatingChanged,
            changeCount,
            enchantments: result,
        },
        storedTargetsChanged,
    };
}

/**
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {StationEnchantPlan} plan
 */
export function applyStationEnchantPlan(stack, plan) {
    if (!plan.changed) return stack.clone();
    const result = stack.clone();
    return replaceEnchantments(result, plan.enchantments) ? result : undefined;
}

/** @param {import("@minecraft/server").ItemStack} stack */
function readEnchantments(stack) {
    const enchantable = getEnchantable(stack);
    if (!enchantable) return [];

    try {
        return enchantable.getEnchantments()
            .map((entry) => ({
                id: normalizeId(entry.type?.id),
                level: Math.max(1, Math.floor(Number(entry.level) || 1)),
            }))
            .filter((entry) => entry.id.length > 0);
    } catch {
        return [];
    }
}

/**
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {{ id: string, level: number }[]} enchantments
 */
function replaceEnchantments(stack, enchantments) {
    const enchantable = getEnchantable(stack);
    if (!enchantable) return false;

    const native = [];
    for (let index = 0; index < enchantments.length; index++) {
        const entry = enchantments[index];
        const type = getEnchantmentsById().get(entry.id);
        if (!type) return false;
        native.push({ type, level: Math.max(1, Math.min(type.maxLevel, Math.floor(entry.level))) });
    }

    try {
        enchantable.removeAllEnchantments();
        if (native.length > 0) enchantable.addEnchantments(native);
        return true;
    } catch {
        return false;
    }
}

/** @param {import("@minecraft/server").ItemEnchantableComponent} enchantable */
function buildSourcePool(enchantable) {
    const byId = getEnchantmentsById();
    const result = [];

    for (let sourceIndex = 0; sourceIndex < ENCHANTMENT_SOURCES.length; sourceIndex++) {
        const source = ENCHANTMENT_SOURCES[sourceIndex];
        const valid = [];
        for (let idIndex = 0; idIndex < source.length; idIndex++) {
            const id = source[idIndex];
            const type = byId.get(id);
            if (type && canAdd(enchantable, type, 1)) valid.push(id);
        }
        if (valid.length > 0) result.push(valid);
    }

    return result;
}

/** @returns {Map<string, import("@minecraft/server").EnchantmentType>} */
function getEnchantmentsById() {
    if (enchantmentsById) return enchantmentsById;
    enchantmentsById = new Map();

    try {
        const all = EnchantmentTypes.getAll() ?? [];
        for (let index = 0; index < all.length; index++) {
            const type = all[index];
            const id = normalizeId(type?.id);
            if (id) enchantmentsById.set(id, type);
        }
    } catch {}

    return enchantmentsById;
}

/**
 * @param {import("@minecraft/server").ItemEnchantableComponent} enchantable
 * @param {import("@minecraft/server").EnchantmentType} type
 * @param {number} level
 */
function canAdd(enchantable, type, level) {
    try {
        return enchantable.canAddEnchantment({ type, level }) === true;
    } catch {
        return false;
    }
}

/** @param {number} moduleLevel @param {number} maximum */
function getTargetLevel(moduleLevel, maximum) {
    const tier = Math.max(1, Math.min(5, Math.floor(moduleLevel)));
    const max = Math.max(1, Math.min(5, Math.floor(Number(maximum) || 1)));
    const maxIndex = TARGET_MAX_LEVELS.indexOf(max);
    return maxIndex < 0 ? 0 : Math.min(max, TARGET_LEVELS[tier - 1]?.[maxIndex] ?? 0);
}

/** @param {{id:string,level:number}[]} before @param {{id:string,level:number}[]} after */
function countPositiveChanges(before, after) {
    const beforeById = new Map(before.map((entry) => [entry.id, entry.level]));
    let changes = 0;
    for (let index = 0; index < after.length; index++) {
        const entry = after[index];
        if (entry.level > (beforeById.get(entry.id) ?? 0)) changes++;
    }
    return changes;
}

/** @param {import("@minecraft/server").ItemStack} stack */
function getEnchantable(stack) {
    try {
        return /** @type {import("@minecraft/server").ItemEnchantableComponent | undefined} */ (
            stack.getComponent(ENCHANTABLE_COMPONENT_ID)
        );
    } catch {
        return undefined;
    }
}

/** @param {import("@minecraft/server").ItemStack} stack */
function readStoredTargets(stack) {
    try {
        const raw = stack.getDynamicProperty(STORED_TARGETS_KEY);
        if (typeof raw !== "string" || raw.length === 0) return undefined;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.ids)) return undefined;
        return {
            moduleLevel: Math.max(0, Math.floor(Number(parsed.moduleLevel) || 0)),
            ids: parsed.ids.map(normalizeId).filter(Boolean),
            curseRoll: Number(parsed.curseRoll),
        };
    } catch {
        return undefined;
    }
}

/** @param {import("@minecraft/server").ItemStack} stack @param {{moduleLevel:number,ids:string[],curseRoll:number}} value */
function writeStoredTargets(stack, value) {
    try {
        stack.setDynamicProperty(STORED_TARGETS_KEY, JSON.stringify(value));
    } catch {}
}

function emptyPlan() {
    return /** @type {StationEnchantPlan} */ ({
        version: 1,
        changed: false,
        enchantingChanged: false,
        curatingChanged: false,
        changeCount: 0,
        enchantments: [],
    });
}

/** @param {unknown} value */
function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase();
}

/**
 * @typedef {{ enchantability: number, reinforcement: number, curseProtection: number }} StationModules
 * @typedef {{
 *   version: 1,
 *   changed: boolean,
 *   enchantingChanged: boolean,
 *   curatingChanged: boolean,
 *   changeCount: number,
 *   enchantments: {id:string,level:number}[]
 * }} StationEnchantPlan
 */
