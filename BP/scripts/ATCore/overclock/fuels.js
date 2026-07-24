// @ts-check

const fuels = new Map();

export function registerOverclockFuel(itemTypeId, definition) {
    const id = String(itemTypeId ?? "").trim();
    const duration = Math.max(1, Math.floor(Number(definition?.duration) || 0));
    const power = Math.max(0, Number(definition?.power) || 0);
    const effectiveness = Math.max(0, Number(definition?.effectiveness) || 0);

    if (!id || power <= 0 || effectiveness <= 0) {
        throw new TypeError(`Invalid overclock fuel registration: ${id || "<empty>"}`);
    }

    const compiled = { itemTypeId: id, duration, power, effectiveness };
    fuels.set(id, compiled);
    return compiled;
}

export function registerOverclockFuels(definitions) {
    let count = 0;
    for (const [itemTypeId, definition] of Object.entries(definitions ?? {})) {
        registerOverclockFuel(itemTypeId, definition);
        count++;
    }
    return count;
}

export function getOverclockFuel(itemTypeId) {
    return fuels.get(itemTypeId);
}

export function getOverclockFuels() {
    return fuels;
}
