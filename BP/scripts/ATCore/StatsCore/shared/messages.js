/**
 * Safely writes a message to the action bar without throwing on unsupported entities.
 *
 * @param {import("@minecraft/server").Entity | import("@minecraft/server").Player} target
 * @param {string} message
 * @returns {boolean}
 */
export function setActionBarSafe(target, message) {
    if (!message) return false;

    try {
        target?.onScreenDisplay?.setActionBar?.(message);
        return true;
    } catch {
        return false;
    }
}

