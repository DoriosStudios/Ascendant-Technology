export const ID = "utilitycraft:mob_slasher";
export const RANGE = Object.freeze([0.5, 2, 3.5, 5, 6.5, 8, 9.5, 11, 12.5]);
export const DAMAGE_CAP = 16;
export const XP_CAP = 256000;
export const MODULES = Object.freeze({
    "utilitycraft:mob_magnet": "mobMagnet",
    "utilitycraft:xp_magnet": "xpMagnet",
    "utilitycraft:ender_hopper": "teleporter",
    "utilitycraft:xp_condenser": "storer",
});
export const DIRECTIONS = Object.freeze([
    { name: "North", x: 0, y: 0, z: -1 }, { name: "South", x: 0, y: 0, z: 1 },
    { name: "East", x: 1, y: 0, z: 0 }, { name: "West", x: -1, y: 0, z: 0 },
    { name: "Up", x: 0, y: 1, z: 0 }, { name: "Down", x: 0, y: -1, z: 0 },
]);
export const clamp = (value, max) => Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
export const damageAt = level => 8 + 2 * clamp(level, DAMAGE_CAP);
export function rangeLevel(state) { return clamp(state.range ?? state.upgrades.range, state.upgrades.range); }
export function damageLevel(state) { return clamp(state.damage ?? state.upgrades.damage, state.upgrades.damage); }
