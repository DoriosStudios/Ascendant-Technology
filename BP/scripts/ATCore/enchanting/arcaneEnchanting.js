// @ts-check

import { EnchantmentTypes } from "@minecraft/server";

const ENCHANTABLE_COMPONENT_ID = "minecraft:enchantable";

const ENCHANTABILITY_MODULE_LEVELS = new Map([
    ["utilitycraft:enchantability_module", 1],
    ["utilitycraft:enchantability_module_2", 2],
    ["utilitycraft:enchantability_module_3", 3],
    ["utilitycraft:enchantability_module_4", 4],
    ["utilitycraft:enchantability_module_5", 5],
]);
const CURSE_PROTECTION_MODULES = new Set([
    "utilitycraft:curse_protection_module",
]);
const CURSE_ENCHANTMENTS = new Set([
    "binding",
    "minecraft:binding",
    "vanishing",
    "minecraft:vanishing",
]);

const ENCHANTMENT_MAX_LEVELS = [5, 4, 3, 2, 1];
const ENCHANTMENT_TARGETS = [
    [1, 1, 1, 0, 0],
    [2, 2, 1, 0, 0],
    [3, 2, 2, 1, 0],
    [4, 3, 2, 2, 0],
    [5, 4, 3, 2, 1],
];

/** @type {{ all: import("@minecraft/server").EnchantmentType[], byId: Map<string, import("@minecraft/server").EnchantmentType> } | undefined} */
let enchantmentCatalog;

/**
 * Resolves an enchantability module item to its legacy tier.
 *
 * @param {import("@minecraft/server").ItemStack | undefined} stack
 * @returns {number}
 */
export function getEnchantabilityModuleLevel(stack) {
    return ENCHANTABILITY_MODULE_LEVELS.get(stack?.typeId ?? "") ?? 0;
}

/** @param {import("@minecraft/server").ItemStack | undefined} stack */
export function hasCurseProtectionModule(stack) {
    if (!stack) return false;
    if (CURSE_PROTECTION_MODULES.has(stack.typeId)) return true;
    try {
        return stack.hasTag?.("utilitycraft:ascane_curse_protection") === true;
    } catch {
        return false;
    }
}

/**
 * Produces a stable signature for one input/module combination. Enchantment
 * order is normalized so the same item state does not invalidate a locked plan.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {number} moduleLevel
 * @returns {string}
 */
export function createArcaneEnchantSignature(stack, moduleLevel, curseProtection = false) {
    const enchantments = readEnchantments(stack)
        .map((entry) => `${entry.id}@${entry.level}`)
        .sort()
        .join(",");

    return `${stack.typeId}|m${normalizeModuleLevel(moduleLevel)}|p${curseProtection ? 1 : 0}|${enchantments}`;
}

/**
 * Builds one complete Arcane Enchanter plan. The enchantment catalog is cached,
 * current enchantments use maps for O(1) identity lookups, and compatibility is
 * evaluated only while creating a new operation.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {number} moduleLevel
 * @returns {ArcaneEnchantPlan}
 */
export function buildArcaneEnchantPlan(stack, moduleLevel, curseProtection = false) {
    const enchantable = getEnchantableComponent(stack);
    if (!enchantable) return invalidPlan("Invalid Item");

    const tier = normalizeModuleLevel(moduleLevel);
    const current = readEnchantments(stack);
    const next = current.map((entry) => ({ id: entry.id, level: entry.level }));
    const nextById = new Map(next.map((entry, index) => [entry.id, index]));
    const catalog = getEnchantmentCatalog();

    let upgradedCount = 0;
    for (let index = 0; index < current.length; index++) {
        const entry = current[index];
        const type = catalog.byId.get(entry.id) ?? safeGetEnchantmentType(entry.id);
        if (!type) continue;

        const targetLevel = resolveModuleEnchantTarget(tier, type.maxLevel);
        const finalLevel = Math.min(type.maxLevel, Math.max(entry.level, targetLevel));
        if (finalLevel <= entry.level) continue;

        next[index] = { id: entry.id, level: finalLevel };
        upgradedCount++;
    }

    const workingStack = stack.clone();
    const workingEnchantable = getEnchantableComponent(workingStack);
    const candidates = [];

    if (workingEnchantable) {
        for (let index = 0; index < catalog.all.length; index++) {
            const type = catalog.all[index];
            const id = normalizeEnchantmentId(type?.id);
            if (!id || nextById.has(id)) continue;
            if (curseProtection && CURSE_ENCHANTMENTS.has(id)) continue;

            const targetLevel = resolveModuleEnchantTarget(tier, type.maxLevel);
            if (targetLevel <= 0) continue;

            try {
                if (workingEnchantable.canAddEnchantment({ type, level: targetLevel })) {
                    candidates.push({ id, level: targetLevel, type });
                }
            } catch {}
        }
    }

    shuffleInPlace(candidates);

    let addedCount = 0;
    for (let index = 0; next.length < tier && index < candidates.length; index++) {
        const candidate = candidates[index];
        if (nextById.has(candidate.id)) continue;

        try {
            // Mutating the disposable clone makes every later compatibility
            // check account for enchantments selected earlier in this plan.
            workingEnchantable?.addEnchantment({
                type: candidate.type,
                level: candidate.level,
            });
        } catch {
            continue;
        }

        nextById.set(candidate.id, next.length);
        next.push({ id: candidate.id, level: candidate.level });
        addedCount++;
    }

    if (current.length === 0 && next.length === 0) {
        return invalidPlan("Not Enchantable");
    }

    const changeCount = countPlanChanges(current, next);
    const changed = changeCount > 0;

    return {
        version: 1,
        ready: true,
        changed,
        changeCount,
        addedCount,
        upgradedCount,
        targetSummary: changed
            ? `${next.length} enchants (${addedCount} new, ${upgradedCount} upgraded)`
            : `${next.length} enchants (stable)`,
        enchantments: next,
    };
}

/**
 * Applies a previously locked plan to a clone of the source item. Item name,
 * lore, durability and other metadata remain intact because the original stack
 * is cloned instead of reconstructed.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {ArcaneEnchantPlan} plan
 * @returns {import("@minecraft/server").ItemStack | undefined}
 */
export function applyArcaneEnchantPlan(stack, plan) {
    if (!isArcaneEnchantPlan(plan) || !plan.ready) return undefined;

    const result = stack.clone();
    const enchantable = getEnchantableComponent(result);
    if (!enchantable) return undefined;

    const enchantments = [];
    for (let index = 0; index < plan.enchantments.length; index++) {
        const entry = plan.enchantments[index];
        const type = getEnchantmentCatalog().byId.get(entry.id) ?? safeGetEnchantmentType(entry.id);
        if (!type) return undefined;

        enchantments.push({
            type,
            level: Math.max(1, Math.min(type.maxLevel, Math.floor(entry.level))),
        });
    }

    try {
        enchantable.removeAllEnchantments();
        enchantable.addEnchantments(enchantments);
        return result;
    } catch {
        return undefined;
    }
}

/**
 * Computes the same module discount and per-change multiplier as the legacy
 * machine, without performing any inventory or world work.
 *
 * @param {number} configuredEnergyCost
 * @param {number} moduleLevel
 * @param {number} changeCount
 * @param {{ minimumEnergyCost?: number, xpPerChange?: number }} [options]
 */
export function getArcaneEnchantCosts(configuredEnergyCost, moduleLevel, changeCount, options = {}) {
    const baseCost = Math.max(1, Number(configuredEnergyCost) || 1);
    const minimumEnergyCost = Math.max(1, Number(options.minimumEnergyCost) || 4000);
    const xpPerChange = Math.max(1, Math.floor(Number(options.xpPerChange) || 1000));
    const changes = Math.max(1, Math.floor(Number(changeCount) || 1));
    const moduleDiscount = Math.max(0.5, 1 - normalizeModuleLevel(moduleLevel) * 0.08);
    const changeMultiplier = 1 + (changes - 1) * 0.25;

    return {
        energy: Math.max(minimumEnergyCost, Math.ceil(baseCost * moduleDiscount * changeMultiplier)),
        xp: changes * xpPerChange,
    };
}

/**
 * Converts a desired duration into the multiplier expected by advanceProcess.
 * Machine processing intervals and speed boosts remain handled by Machine.
 *
 * @param {number} baseRate
 * @param {number} energyCost
 * @param {number} seconds
 * @returns {number}
 */
export function getArcaneRateMultiplier(baseRate, energyCost, seconds = 6) {
    const rate = Math.max(Number.EPSILON, Number(baseRate) || 0);
    const ticks = Math.max(1, Math.round((Number(seconds) || 6) * 20));
    return Math.max(0, Number(energyCost) || 0) / (rate * ticks);
}

/**
 * Validates persisted operation data before it is reused after a world reload.
 *
 * @param {unknown} value
 * @returns {value is ArcaneEnchantPlan}
 */
export function isArcaneEnchantPlan(value) {
    if (!value || typeof value !== "object") return false;
    const plan = /** @type {Record<string, unknown>} */ (value);
    if (plan.version !== 1 || typeof plan.ready !== "boolean") return false;
    if (!plan.ready) return typeof plan.message === "string";
    if (!Array.isArray(plan.enchantments)) return false;

    return plan.enchantments.every((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const enchantment = /** @type {Record<string, unknown>} */ (entry);
        return typeof enchantment.id === "string"
            && enchantment.id.length > 0
            && Number.isFinite(enchantment.level)
            && Number(enchantment.level) > 0;
    });
}

/**
 * @param {import("@minecraft/server").ItemStack} stack
 * @returns {import("@minecraft/server").ItemEnchantableComponent | undefined}
 */
function getEnchantableComponent(stack) {
    try {
        return /** @type {import("@minecraft/server").ItemEnchantableComponent | undefined} */ (
            stack.getComponent(ENCHANTABLE_COMPONENT_ID)
        );
    } catch {
        return undefined;
    }
}

/**
 * @param {import("@minecraft/server").ItemStack} stack
 * @returns {SerializedEnchantment[]}
 */
function readEnchantments(stack) {
    const enchantable = getEnchantableComponent(stack);
    if (!enchantable) return [];

    try {
        return enchantable.getEnchantments()
            .map((entry) => ({
                id: normalizeEnchantmentId(entry.type.id),
                level: Math.max(1, Math.floor(Number(entry.level) || 1)),
            }))
            .filter((entry) => entry.id.length > 0);
    } catch {
        return [];
    }
}

/**
 * @returns {{ all: import("@minecraft/server").EnchantmentType[], byId: Map<string, import("@minecraft/server").EnchantmentType> }}
 */
function getEnchantmentCatalog() {
    if (enchantmentCatalog) return enchantmentCatalog;

    /** @type {import("@minecraft/server").EnchantmentType[]} */
    let all = [];
    try {
        all = EnchantmentTypes.getAll() ?? [];
    } catch {}

    const byId = new Map();
    for (let index = 0; index < all.length; index++) {
        const type = all[index];
        const id = normalizeEnchantmentId(type?.id);
        if (id) byId.set(id, type);
    }

    enchantmentCatalog = { all, byId };
    return enchantmentCatalog;
}

/**
 * @param {string} id
 * @returns {import("@minecraft/server").EnchantmentType | undefined}
 */
function safeGetEnchantmentType(id) {
    try {
        return EnchantmentTypes.get(id);
    } catch {
        return undefined;
    }
}

/**
 * @param {number} moduleLevel
 * @param {number} enchantmentMaxLevel
 * @returns {number}
 */
function resolveModuleEnchantTarget(moduleLevel, enchantmentMaxLevel) {
    const tier = normalizeModuleLevel(moduleLevel);
    const normalizedMax = Math.max(1, Math.min(5, Math.floor(Number(enchantmentMaxLevel) || 1)));
    const levelIndex = ENCHANTMENT_MAX_LEVELS.indexOf(normalizedMax);
    if (levelIndex < 0) return 0;

    return Math.max(0, Math.min(
        ENCHANTMENT_TARGETS[tier - 1]?.[levelIndex] ?? 0,
        normalizedMax,
    ));
}

/**
 * @param {SerializedEnchantment[]} before
 * @param {SerializedEnchantment[]} after
 * @returns {number}
 */
function countPlanChanges(before, after) {
    const beforeById = new Map(before.map((entry) => [entry.id, entry.level]));
    let changes = 0;

    for (let index = 0; index < after.length; index++) {
        const entry = after[index];
        if (entry.level > (beforeById.get(entry.id) ?? 0)) changes++;
    }

    return changes;
}

/**
 * @template T
 * @param {T[]} list
 * @returns {void}
 */
function shuffleInPlace(list) {
    for (let index = list.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        const temporary = list[index];
        list[index] = list[randomIndex];
        list[randomIndex] = temporary;
    }
}

/** @param {number} value */
function normalizeModuleLevel(value) {
    return Math.max(1, Math.min(5, Math.floor(Number(value) || 1)));
}

/** @param {unknown} value */
function normalizeEnchantmentId(value) {
    return String(value ?? "").trim().toLowerCase();
}

/**
 * @param {string} message
 * @returns {ArcaneEnchantPlan}
 */
function invalidPlan(message) {
    return /** @type {ArcaneEnchantPlan} */ ({
        version: 1,
        ready: false,
        message,
        changed: false,
        changeCount: 0,
        addedCount: 0,
        upgradedCount: 0,
        targetSummary: "-",
        enchantments: [],
    });
}

/**
 * @typedef {{ id: string, level: number }} SerializedEnchantment
 * @typedef {{
 *   version: 1,
 *   ready: boolean,
 *   message?: string,
 *   changed: boolean,
 *   changeCount: number,
 *   addedCount: number,
 *   upgradedCount: number,
 *   targetSummary: string,
 *   enchantments: SerializedEnchantment[]
 * }} ArcaneEnchantPlan
 */
