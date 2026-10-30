// Read-only, incremental inspection of the loaded, wired energy component.
// No fixed node/type limit; the budget limits work per update, not network size.
export const MONITOR_DIRECTIONS = [
    ["east", "west", 1, 0, 0], ["west", "east", -1, 0, 0],
    ["up", "down", 0, 1, 0], ["down", "up", 0, -1, 0],
    ["south", "north", 0, 0, 1], ["north", "south", 0, 0, -1],
];
const key = p => `${p.x},${p.y},${p.z}`;
export function connectionOpen(block, direction, neighbor, opposite) {
    for (const [b, face] of [[block, direction], [neighbor, opposite]]) {
        if (b.hasTag("dorios:isTube") && b.permutation.getState(`utilitycraft:${face}`) !== true) return false;
    }
    return true;
}
export class NetworkMonitor {
    constructor(origin, adapter) {
        this.origin = origin; this.adapter = adapter;
        this.snapshot = null; this.scan = null;
    }
    start() {
        this.scan = { byKind: Object.fromEntries(["machines", "generators", "batteries", "relays"].map(kind => [kind, {
                count: 0, active: 0, unknown: 0, stored: 0, capacity: 0, empty: 0, full: 0,
            }])), queue: [this.origin], head: 0, queued: new Set([key(this.origin)]), seenEntities: new Set(), unavailableKeys: new Set(),
            members: [], types: new Map(), cables: 0, unavailable: 0, stored: 0, capacity: 0,
            batteryStored: 0, batteryCapacity: 0, batteries: 0, machines: 0, generators: 0, relays: 0, consumers: 0, active: 0, generation: 0, activeGeneration: 0, transfer: 0, distribution: 0 };
    }
    step(tick, budget = 64) {
        if (!this.scan) this.start();
        const s = this.scan;
        const unavailable = pos => { const id = key(pos); if (!s.unavailableKeys.has(id)) { s.unavailableKeys.add(id); s.unavailable++; } };
        for (let n = 0; n < budget && s.head < s.queue.length; n++) {
            const pos = s.queue[s.head++];
            let block;
            try { block = this.adapter.block(pos); } catch { unavailable(pos); continue; }
            if (!block) { unavailable(pos); continue; }
            if (!block.hasTag("dorios:energy")) continue;
            const root = key(pos) === key(this.origin);
            const cable = block.hasTag("dorios:isTube") || block.typeId === "utilitycraft:energy_cable" || block.typeId === "utilitycraft:reinforced_cable";
            // Machines are endpoints, not invisible cables connecting separate grids.
            if (root || cable) for (const [dir, opposite, x, y, z] of MONITOR_DIRECTIONS) {
                const next = { x: pos.x + x, y: pos.y + y, z: pos.z + z }, id = key(next);
                if (s.queued.has(id)) continue;
                let neighbor;
                try { neighbor = this.adapter.block(next); } catch { unavailable(next); continue; }
                if (!neighbor) { unavailable(next); continue; }
                if (neighbor.hasTag("dorios:energy") && connectionOpen(block, dir, neighbor, opposite)) {
                    s.queued.add(id); s.queue.push(next);
                }
            }
            if (root) continue;
            if (cable) { s.cables++; continue; }
            let entry;
            try { entry = this.adapter.read(block); } catch { unavailable(pos); continue; }
            if (!entry || entry.id === this.adapter.selfId || s.seenEntities.has(entry.id)) continue;
            s.seenEntities.add(entry.id); s.members.push(entry.id);
            s.stored += entry.stored; s.capacity += entry.capacity;
            s[entry.kind]++;
            if (entry.kind === "batteries") { s.batteryStored += entry.stored; s.batteryCapacity += entry.capacity; }
            if (entry.active === true) s.active++;
            const consumer = entry.consumer ?? entry.kind === "machines";
            if (consumer) s.consumers++;
            if (entry.kind === "generators") {
                s.generation += entry.generation ?? 0;
                if (entry.active === true) s.activeGeneration += entry.generation ?? 0;
            }
            s.transfer += entry.transfer ?? 0;
            s.distribution += entry.distribution ?? 0;
            const type = entry.type ?? block.typeId;
            const groupKey = `${entry.kind}:${type}`;
            const group = s.types.get(groupKey) ?? { type, kind: entry.kind, count: 0, active: 0, unknown: 0,
                stored: 0, capacity: 0, consumers: 0, generation: 0, distribution: 0, transfer: 0, empty: 0, full: 0 };
            for (const target of [group, s.byKind[entry.kind]]) {
                target.count++; target.stored += entry.stored; target.capacity += entry.capacity;
                if (entry.active === true) target.active++;
                else if (entry.active !== false) target.unknown++;
                if (entry.capacity > 0 && entry.stored <= 0) target.empty++;
                if (entry.capacity > 0 && entry.stored >= entry.capacity) target.full++;
            }
            if (consumer) group.consumers++;
            group.generation += entry.generation ?? 0;
            group.transfer += entry.transfer ?? 0;
            group.distribution += entry.distribution ?? 0;
            s.types.set(groupKey, group);
        }
        if (s.head < s.queue.length) return false;
        const signature = [...s.members].sort().join("|");
        const old = this.snapshot;
        s.sampleTicks = old && old.signature === signature && !old.unavailable && !s.unavailable && tick > old.tick ? tick - old.tick : null;
        s.delta = s.sampleTicks === null ? null : (s.stored - old.stored) / s.sampleTicks;
        s.netGain = s.delta === null ? null : Math.max(0, s.delta);
        s.netLoss = s.delta === null ? null : Math.max(0, -s.delta);
        const { queue, head, queued, seenEntities, unavailableKeys, ...summary } = s;
        this.snapshot = { ...summary, signature, tick };
        this.scan = null;
        return true;
    }
}

// Keep text in lore/RawMessage, never the 255-character item nameTag.
export function monitorMessage(parts) {
    const rawtext = parts.flatMap(part => {
        if (typeof part !== "string") return [part];
        const chunks = [];
        for (let start = 0; start < part.length;) {
            let end = Math.min(part.length, start + 200);
            if (end < part.length && (part[end - 1] === "§" || /[\uD800-\uDBFF]/.test(part[end - 1]))) end--;
            chunks.push({ text: part.slice(start, end) }); start = end;
        }
        return chunks;
    });
    return { rawtext: rawtext.length ? rawtext : [{ text: " " }] };
}


// ItemStack.setLore limits apply to each complete serialized entry, not to rawtext fragments.
// Leave room for formatting/header overhead; 99 entries plus one page header fit the 100-entry cap.
export const MONITOR_LORE_ENTRY_LIMIT = 900;
export const MONITOR_LORE_PAGE_LINES = 99;
const serializedSize = value => {
    let size = 0;
    for (const char of JSON.stringify(value)) {
        const code = char.codePointAt(0);
        size += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    }
    return size;
};
export function monitorLorePages(parts) {
    const rows = [[]];
    for (const part of monitorMessage(parts).rawtext) {
        if (part.text === undefined) { rows[rows.length - 1].push(part); continue; }
        const lines = part.text.split("\n");
        lines.forEach((line, i) => {
            if (i) rows.push([]);
            if (line) rows[rows.length - 1].push({ text: line });
        });
    }
    const entries = [];
    let current = [];
    const fits = rawtext => serializedSize({ rawtext: [{ text: "§r§7" }, ...rawtext] }) <= MONITOR_LORE_ENTRY_LIMIT;
    const flush = () => { entries.push({ rawtext: [{ text: "§r§7" }, ...current] }); current = []; };
    for (const row of rows) {
        const candidate = [...current, ...(current.length ? [{ text: "\n" }] : []), ...row];
        if (fits(candidate)) { current = candidate; continue; }
        if (current.length) flush();
        for (const part of row) {
            if (!fits([part])) throw new RangeError("A Network Center translation token exceeds the lore entry limit");
            if (!fits([...current, part])) flush();
            current.push(part);
        }
    }
    if (current.length || !entries.length) flush();
    const pages = [];
    for (let i = 0; i < entries.length; i += MONITOR_LORE_PAGE_LINES) pages.push(entries.slice(i, i + MONITOR_LORE_PAGE_LINES));
    return pages;
}
