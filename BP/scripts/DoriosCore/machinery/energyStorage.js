import { world, ItemStack, system } from "@minecraft/server";
import { loadObjectives } from "../utils/scoreboards.js";
import { shouldRefreshEntityUi } from "./ui_refresh.js";

/**
 * Utility class to manage scoreboard-based energy values for entities.
 */
export class Energy {
    /**
     * Creates a new Energy instance linked to the given entity.
     *
     * @param {Entity} entity The entity this manager is attached to.
     */
    constructor(entity) {
        this.entity = entity;
        this.scoreId = entity?.scoreboardIdentity;
        this.ensureScoreId();
        this.cap = this.scoreId ? this.getCap() : undefined;
    }

    //#region Statics

    /**
     * Global scoreboard objectives registry.
     * Populated once the world finishes loading via initializeObjectives().
     */
    static #objectives = Object.create(null);

    /**
     * Returns the internal objectives registry.
     * @returns {Record<string, ScoreboardObjective>}
     */
    static get objectives() {
        return Energy.#objectives;
    }

    /**
     * Initializes and caches all Energy scoreboard objectives.
     * Must be called once after the world has finished loading.
     */
    static initializeObjectives() {
        loadObjectives([
            ["energy", "Energy"],
            ["energyExp", "EnergyExp"],
            ["energyCap", "Energy Max Capacity"],
            ["energyCapExp", "Energy Max Capacity Exp"],
        ], Energy.#objectives);
    }

    /**
     * Ensures that the given entity has a valid scoreboard identity.
     *
     * @param {Entity} entity The entity representing the machine.
     * @returns {void}
     */
    static initialize(entity) {
        if (!entity) return;
        entity.runCommand(`scoreboard players set @s energy 0`);
    }

    ensureScoreId() {
        if (this.scoreId || !this.entity) return this.scoreId;

        try {
            Energy.initialize(this.entity);
        } catch {
            return undefined;
        }

        this.scoreId = this.entity?.scoreboardIdentity;
        return this.scoreId;
    }

    /**
     * Normalizes a raw number into a scoreboard-safe mantissa and exponent.
     *
     * @param {number} amount The raw number to normalize.
     * @returns {{ value: number, exp: number }}
     */
    static normalizeValue(amount) {
        let exp = 0;
        let value = amount;

        while (value > 1e9) {
            value /= 1000;
            exp += 3;
        }

        return { value: Math.floor(value), exp };
    }

    /**
     * Combines a mantissa and exponent back into the full number.
     *
     * @param {number} value The mantissa part of the number.
     * @param {number} exp The exponent part of the number.
     * @returns {number}
     */
    static combineValue(value, exp) {
        return value * (10 ** exp);
    }

    /**
     * Formats a numerical Dorios Energy (DE) value into a human-readable string.
     * 
     * @param {number} value The energy value in DE.
     * @returns {string}
     */
    static formatEnergyToText(value) {
        let unit = 'DE';

        if (value >= 1e15) {
            unit = 'PDE';
            value /= 1e15;
        } else if (value >= 1e12) {
            unit = 'TDE';
            value /= 1e12;
        } else if (value >= 1e9) {
            unit = 'GDE';
            value /= 1e9;
        } else if (value >= 1e6) {
            unit = 'MDE';
            value /= 1e6;
        } else if (value >= 1e3) {
            unit = 'kDE';
            value /= 1e3;
        }

        return `${parseFloat(value.toFixed(2))} ${unit}`;
    }

    /**
     * Parses a formatted energy string and returns the numeric value in DE.
     * 
     * @param {string} input The string with formatted energy.
     * @param {number} index Which value to extract: 0 = current, 1 = max.
     * @returns {number}
     */
    static getEnergyFromText(input, index = 0) {
        if (typeof input !== "string" || input.length === 0) return 0;

        const cleanedInput = input.replace(/§[0-9a-frklmnor]/gi, '');

        const matches = [...cleanedInput.matchAll(/([\d.]+)\s*(kDE|MDE|GDE|TDE|PDE|DE)/gi)];
        if (!matches.length || index < 0 || index >= matches.length) return 0;

        const [, valueStr, rawUnit] = matches[index];
        const unit = rawUnit?.toUpperCase?.() ?? 'DE';

        const multipliers = {
            DE: 1,
            KDE: 1e3,
            MDE: 1e6,
            GDE: 1e9,
            TDE: 1e12,
            PDE: 1e15
        };

        const multiplier = multipliers[unit] ?? 1;
        const value = parseFloat(valueStr);
        if (!Number.isFinite(value)) return 0;

        return value * multiplier;
    }
    //#endregion

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

        const currentLore = Energy.getItemLore(current);
        const nextLore = Energy.getItemLore(next);
        if (currentLore.length !== nextLore.length) return true;
        for (let index = 0; index < currentLore.length; index++) {
            if (currentLore[index] !== nextLore[index]) return true;
        }

        return false;
    }

    //#region Caps
    setCap(amount) {
        if (!this.ensureScoreId()) return;
        const { value, exp } = Energy.normalizeValue(amount);
        Energy.#objectives.energyCap.setScore(this.scoreId, value);
        Energy.#objectives.energyCapExp.setScore(this.scoreId, exp);
        this.cap = Energy.combineValue(value, exp);
    }

    getCap() {
        if (!this.ensureScoreId()) return this.cap || 0;
        if (!this.scoreId) return this.cap || 0;
        const value = Energy.#objectives.energyCap?.getScore(this.scoreId) || 0;
        const exp = Energy.#objectives.energyCapExp?.getScore(this.scoreId) || 0;

        this.cap = Energy.combineValue(value, exp);
        return this.cap;
    }

    getCapNormalized() {
        if (!this.ensureScoreId()) return { value: 0, exp: 0 };
        if (!this.scoreId) return { value: 0, exp: 0 };
        const value = Energy.#objectives.energyCap?.getScore(this.scoreId) || 0;
        const exp = Energy.#objectives.energyCapExp?.getScore(this.scoreId) || 0;

        this.cap = Energy.combineValue(value, exp);
        return { value, exp };
    }
    //#endregion

    set(amount) {
        if (!this.ensureScoreId()) return;
        const { value, exp } = Energy.normalizeValue(amount);

        Energy.#objectives.energy.setScore(this.scoreId, value);
        Energy.#objectives.energyExp.setScore(this.scoreId, exp);
    }

    get() {
        if (!this.ensureScoreId()) return 0;
        if (!this.scoreId) return 0;
        const value = Energy.#objectives.energy?.getScore(this.scoreId) || 0;
        const exp = Energy.#objectives.energyExp?.getScore(this.scoreId) || 0;
        return Energy.combineValue(value, exp);
    }

    getNormalized() {
        if (!this.ensureScoreId()) return { value: 0, exp: 0 };
        if (!this.scoreId) return { value: 0, exp: 0 };
        return {
            value: Energy.#objectives.energy?.getScore(this.scoreId) || 0,
            exp: Energy.#objectives.energyExp?.getScore(this.scoreId) || 0,
        };
    }

    getFreeSpace() {
        if (this.cap === undefined) {
            this.getCap();
        }
        const current = this.get();
        return Math.max(0, this.cap - current);
    }

    add(amount) {
        if (!this.ensureScoreId()) return 0;
        const free = this.getFreeSpace();
        if (amount > 0 && free <= 0) return 0;

        if (amount > free) {
            amount = free;
        }

        let { value, exp } = this.getNormalized();
        const multi = 10 ** exp;

        const normalizedAdd = Math.floor(amount / multi);

        let newValue = value + normalizedAdd;
        if (newValue <= 1e9) {
            Energy.#objectives.energy.addScore(this.scoreId, normalizedAdd);

            if (exp > 0 && value < 1e6) {
                this.set(this.get() + amount);
            }
        } else {
            this.set(this.get() + amount);
        }

        return amount;
    }

    display(slot = 0, options = {}) {
        const container = this.entity.getComponent("minecraft:inventory")?.container;
        if (!container) return;
        if (!shouldRefreshEntityUi(this.entity, `energy:${slot}`, options.interval, options.force === true)) return;

        const energy = this.get();
        const energyCap = this.getCap();

        const safeEnergyCap = Math.max(1, energyCap || 1);
        const energyP = Math.floor((energy / safeEnergyCap) * 48);
        const frame = Math.max(0, Math.min(48, energyP));
        const frameName = frame.toString().padStart(2, "0");

        const item = new ItemStack(`utilitycraft:energy_${frameName}`, 1);
        item.nameTag = `§rEnergy
    §r§7  Stored: ${Energy.formatEnergyToText(energy)} / ${Energy.formatEnergyToText(energyCap)}
§r§7  Percentage: ${this.getPercent().toFixed(2)}%%`;

        const current = container.getItem(slot);
        if (!Energy.shouldReplaceDisplayItem(current, item)) return;

        container.setItem(slot, item);
    }

    //#region Utils
    consume(amount) {
        if (amount <= 0) return 0;

        const current = this.get();
        if (current < amount) return 0;

        this.add(-amount);
        return amount;
    }

    has(amount) {
        return this.get() >= amount;
    }

    isFull() {
        return this.getFreeSpace() === 0;
    }

    rebalance() {
        this.set(this.get());
    }

    getPercent() {
        if (this.cap === undefined) {
            this.getCap();
        }
        if (this.cap <= 0) return 0;
        return Math.min(100, (this.get() / this.cap) * 100);
    }

    transferTo(other, amount) {
        const consumed = this.consume(amount);
        if (consumed <= 0) return 0;

        const added = other.add(consumed);
        return added;
    }

    transferToEntity(entity, amount) {
        const other = new Energy(entity);
        return this.transferTo(other, amount);
    }

    receiveFrom(other, amount) {
        const consumed = other.consume(amount);
        if (consumed <= 0) return 0;

        const added = this.add(consumed);
        return added;
    }

    receiveFromEntity(entity, amount) {
        const other = new Energy(entity);
        return this.receiveFrom(other, amount);
    }
    //#endregion

    /**
     * Transfers energy from this entity to connected energy containers in its network.
     *
     * @param {number} speed Total transfer speed limit (DE/tick).
     * @param {"nearest"|"farthest"|"round"} [mode="nearest"] Transfer mode.
     * @returns {number} Total amount of energy transferred (in DE).
     */
    transferToNetwork(speed, mode) {
        mode = mode ?? this.entity.getDynamicProperty('transferMode');
        let available = this.get();
        speed = Math.min(available, speed)
        if (available <= 0 || speed <= 0) return 0;

        const dim = this.entity.dimension;
        const pos = this.entity.location;
        const isBattery = this.entity.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:battery");
        let transferred = 0;

        // Retrieve or rebuild cached network nodes
        let nodes = this.entity.getDynamicProperty("dorios:energy_nodes");
        const needsUpdate = this.entity.hasTag("updateNetwork");

        if (!nodes || needsUpdate) {
            const positions = this.entity.getTags()
                .filter(tag => tag.startsWith("pos:[") || tag.startsWith("net:["))
                .map(tag => {
                    const [x, y, z] = tag.slice(5, -1).split(",").map(Number);
                    return { x, y, z };
                })
                .sort((a, b) =>
                    DoriosAPI.math.distanceBetween(pos, a) -
                    DoriosAPI.math.distanceBetween(pos, b)
                );

            this.entity.setDynamicProperty("dorios:energy_nodes", JSON.stringify(positions));
            this.entity.removeTag("updateNetwork");
            nodes = JSON.stringify(positions);
        }

        /** @type {{x:number,y:number,z:number}[]} */
        const targets = JSON.parse(nodes);
        if (targets.length === 0) return 0;

        // Select order based on transfer mode
        let orderedTargets = [...targets];
        if (mode === "farthest") orderedTargets.reverse();

        // ROUND MODE
        if (mode === "round") {
            const validEntities = [];
            for (const loc of orderedTargets) {
                const [target] = dim.getEntitiesAtBlockLocation(loc);
                if (!target) continue;

                const tf = target.getComponent("minecraft:type_family");
                if (!tf?.hasTypeFamily("dorios:energy_container")) continue;
                if (isBattery && tf.hasTypeFamily("dorios:battery")) continue;

                const energy = new Energy(target);
                if (energy.getFreeSpace() > 0) validEntities.push(energy);
            }

            if (validEntities.length === 0) {
                return 0;
            }

            const share = Math.floor(Math.min(speed, available) / validEntities.length);
            for (const energy of validEntities) {
                if (available <= 0 || speed <= 0) break;

                const space = energy.getFreeSpace();
                if (space <= 0) continue;

                const amount = Math.min(share, space);
                const added = energy.add(amount);
                if (added > 0) {
                    available -= added;
                    speed -= added;
                    transferred += added;
                }
            }
        }

        // NEAREST / FARTHEST modes (Sequential)
        else {
            for (const loc of orderedTargets) {
                if (available <= 0 || speed <= 0) break;

                const [target] = dim.getEntitiesAtBlockLocation(loc);
                if (!target) continue;

                const tf = target.getComponent("minecraft:type_family");
                if (!tf?.hasTypeFamily("dorios:energy_container")) continue;
                if (isBattery && tf.hasTypeFamily("dorios:battery")) continue;

                const energy = new Energy(target);
                const space = energy.getFreeSpace();
                if (space <= 0) continue;

                const amount = Math.min(space, available, speed);
                const added = energy.add(amount);
                if (added > 0) {
                    available -= added;
                    speed -= added;
                    transferred += added;
                }
            }
        }

        if (transferred > 0) this.consume(transferred);

        return transferred;
    }

}

/**
 * Shares energy from an entity to its adjacent neighbors (6-directions).
 *
 * @param {Entity} entity Source entity.
 * @param {{ perNeighbor?: number, maxTotal?: number, skipSources?: boolean }} [options]
 * @returns {number} Total energy transferred.
 */
export function shareEnergyWithNeighbors(entity, options = {}) {
    if (!entity) return 0;
    const dim = entity.dimension;
    if (!dim) return 0;

    const perNeighbor = Number(options.perNeighbor ?? 10000);
    const maxTotal = Number(options.maxTotal ?? perNeighbor * 6);
    const skipSources = !!options.skipSources;

    const src = new Energy(entity);
    let available = src.get();
    if (available <= 0) return 0;

    const offsets = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
    ];

    let transferred = 0;
    const { x, y, z } = entity.location;

    for (const off of offsets) {
        if (available <= 0 || transferred >= maxTotal) break;
        const pos = { x: Math.floor(x + off.x), y: Math.floor(y + off.y), z: Math.floor(z + off.z) };
        const neighbor = dim.getEntitiesAtBlockLocation(pos)[0];
        if (!neighbor || neighbor === entity) continue;

        const tf = neighbor.getComponent?.("minecraft:type_family");
        if (!tf?.hasTypeFamily?.("dorios:energy_container")) continue;
        if (skipSources && tf.hasTypeFamily?.("dorios:energy_source")) continue;

        const target = new Energy(neighbor);
        const space = target.getFreeSpace();
        if (space <= 0) continue;

        const send = Math.min(perNeighbor, space, available, maxTotal - transferred);
        if (send <= 0) continue;

        const sent = src.transferTo(target, send);
        if (sent > 0) {
            available -= sent;
            transferred += sent;
        }
    }

    return transferred;
}
