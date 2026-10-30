import { system, world, ItemStack } from "@minecraft/server";
import { ButtonManager, EnergyStorage, Machine as CoreMachine } from "DoriosCore/index.js";
import { isLinkNode, resolveLinkNode } from "DoriosLib/linkNodes/index.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
import { NetworkMonitor, monitorMessage, monitorLorePages } from "../../ATCore/networks/networkMonitor.js";
import { setRunning } from "./runtime.js";

const ID = "utilitycraft:network_center";
const states = new Map();
world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => states.delete(removedEntityId));
const family = (entity, name) => entity.getComponent("minecraft:type_family")?.hasTypeFamily(name) === true;
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
function readEndpoint(block) {
    const linked = isLinkNode(block);
    const entity = linked ? resolveLinkNode(block)?.entity : block.dimension.getEntitiesAtBlockLocation(block.location)
        .find(e => family(e, "dorios:energy_container") || family(e, "dorios:energy_source"));
    if (!entity || !entity.isValid) return;
    if (linked) {
        block = entity.dimension.getBlock(entity.location);
        if (!block) return;
    }
    const storage = new EnergyStorage(entity);
    const batteryParams = block.getComponent("utilitycraft:battery")?.customComponentParameters?.params;
    const battery = !!batteryParams || block.hasTag("dorios:battery") || family(entity, "dorios:battery");
    const configs = block.getComponents().map(c => c.customComponentParameters?.params).filter(Boolean);
    const generator = configs.find(p => p.generator)?.generator;
    const machine = configs.find(p => p.machine)?.machine;
    // Beacons transmit an existing buffer; counting their transfer limit as production inflates gains.
    const relay = /^utilitycraft:(?:basic|advanced|expert|ultimate|absolute)_power_beacon$/.test(block.typeId);
    const kind = battery ? "batteries" : relay ? "relays" : generator || (family(entity, "dorios:energy_source") && !block.hasTag("dorios:machine")) ? "generators" : "machines";
    const active = block.permutation?.getState("utilitycraft:on");
    return { id: entity.id, type: block.typeId, kind, active: typeof active === "boolean" ? active : null,
        consumer: kind === "machines" && machine?.energy_cost !== 0,
        stored: number(storage.get()), capacity: number(storage.getCap()),
        generation: kind === "generators" ? number(generator?.rate_speed_base) : 0,
        distribution: relay ? number(generator?.rate_speed_base) : 0,
        transfer: number(batteryParams?.rate_speed_base) };
}
const text = name => ({ translate: `ui.ascendant:network.${name}` });
const label = (name, value) => [text(name), `: §f${value}\n§r§7`];
const heading = name => ["§r§b", text(name), "\n§r§7"];
const energy = value => EnergyStorage.formatEnergyToText(value);
const rate = value => value === null ? "—" : `${energy(value)}/t`;
const fill = (stored, capacity) => `${capacity ? (100 * stored / capacity).toFixed(1) : "0.0"}%`;
function selectedLore(state, slot) {
    const pages = state.pages[slot];
    if (slot === 4) return pages[0];
    const index = Math.min(state.pageIndex[slot] ?? 0, pages.length - 1);
    state.pageIndex[slot] = index;
    return [monitorMessage(["§r§7", text("page"), ` ${index + 1} / ${pages.length}`]), ...pages[index]];
}
function write(machine, slot, parts, state) {
    state.pages ??= {}; state.pageIndex ??= {};
    state.pages[slot] = monitorLorePages(parts);
    const lore = selectedLore(state, slot), signature = JSON.stringify(lore);
    if (state.rendered[slot] === signature) return;
    // Do not refill a clicked item before the shared button watcher observes its removal.
    if (slot < 4 && ButtonManager.activeWatchers.has(machine.entity?.id)
        && machine.container.getItem(slot)?.typeId !== "utilitycraft:ui_filler") return;
    const item = new ItemStack("utilitycraft:ui_filler"); item.nameTag = " "; item.setLore(lore);
    machine.container.setItem(slot, item); state.rendered[slot] = signature;
}
for (let slot = 0; slot < 4; slot++) ButtonManager.registerMachineButton(ID, slot, ({ entity, container }) => {
    const state = states.get(entity.id), pages = state?.pages?.[slot];
    if (!pages) return " ";
    state.pageIndex[slot] = ((state.pageIndex[slot] ?? 0) + 1) % pages.length;
    delete state.rendered[slot];
    state.nextRender = 0;
    // ButtonManager restores its filler after the callback; restore this page's lore afterwards.
    system.run(() => {
        if (states.get(entity.id) !== state || !entity.isValid) return;
        const lore = selectedLore(state, slot), item = new ItemStack("utilitycraft:ui_filler");
        item.nameTag = " "; item.setLore(lore); container.setItem(slot, item);
        state.rendered[slot] = JSON.stringify(lore);
    });
    return " ";
});
// Apply to both new and already placed helpers before checking whether the UI is open.
function prepareMonitor(machine) {
    if (machine.energy.getCap() !== 0) { machine.energy.setCap(0); machine.energy.getCap(); }
    if (machine.energy.get() !== 0) machine.energy.set(0);
    if (family(machine.entity, "dorios:energy_container")) {
        machine.entity.triggerEvent(machine.entity.typeId === "utilitycraft:machine"
            ? "utilitycraft:simple_container" : "utilitycraft:container");
    }
    // Slot 5 was exclusively an energy display. Preserve any unexpected real item.
    if (/^utilitycraft:energy_\d{2}$/.test(machine.container.getItem(5)?.typeId ?? "")) machine.container.setItem(5);
    machine.blockSlots([5]);
}
function render(machine, state) {
    const s = state.monitor.snapshot, progress = state.monitor.scan;
    const status = ["§r", progress ? "§e" : "§a", text(progress ? "scanning" : "ready")];
    if (progress) status.push(` (${progress.head}/${progress.queue.length})`);
    if (s) status.push("  §7· ", text("age"), `: §f${Math.max(0, (system.currentTick - s.tick) / 20).toFixed(1)} s`);
    if (s?.unavailable) status.push("  §e· ", text("unavailable"), `: ${s.unavailable}`);
    write(machine, 4, status, state);
    if (!s) {
        for (let slot = 0; slot < 4; slot++) write(machine, slot, ["§7", text("waiting")], state);
        return;
    }
    const rows = [...s.types.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.type.localeCompare(b.type));
    const name = r => [`§r§f${r.count} × `, { translate: `tile.${r.type}.name` }, "\n§7"];
    const activity = r => [...label("active", r.active), ...label("idle", r.count - r.active - r.unknown),
        ...(r.unknown ? label("unknownActivity", r.unknown) : [])];
    const groups = (kind, makeRow) => {
        const selected = rows.filter(r => r.kind === kind);
        return selected.length ? selected.flatMap(r => [...name(r), ...makeRow(r), "\n"]) : [text("emptyCategory"), "\n"];
    };
    const storage = r => [...label("stored", energy(r.stored)), ...label("capacity", energy(r.capacity)),
        ...label("free", energy(Math.max(0, r.capacity - r.stored))), ...label("fill", fill(r.stored, r.capacity))];
    const balance = s.delta === null ? "—" : `${s.delta < 0 ? "−" : s.delta > 0 ? "+" : ""}${energy(Math.abs(s.delta))}/t`;
    write(machine, 0, [...heading("networkSummary"), ...label("devices", s.members.length), ...label("machines", s.machines),
        ...label("generators", s.generators), ...label("batteries", s.batteries), ...label("relays", s.relays), ...label("cables", s.cables),
        "\n", ...heading("balance"), ...label("delta", balance), ...label("stored", energy(s.stored)), ...label("fill", fill(s.stored, s.capacity)),
        "\n", ...heading("connectedTypes"), ...rows.flatMap(r => [...name(r), text(r.kind), " · ", text("active"), `: ${r.active}`,
            ...(r.unknown ? [" · ", text("unknownActivity"), `: ${r.unknown}`] : []), "\n\n"])], state);
    write(machine, 1, [...heading("production"), ...label("generators", s.generators), ...label("generation", rate(s.generation)),
        ...label("activeGeneration", rate(s.activeGeneration)), "\n", ...heading("netGain"), ...label("netGainRate", rate(s.netGain)),
        ...(s.sampleTicks === null ? [text("needSamples"), "\n"] : label("sampleWindow", `${(s.sampleTicks / 20).toFixed(1)} s`)),
        "\n", ...heading("generatorDetails"), ...groups("generators", r => [...activity(r), ...label("generation", rate(r.generation)), ...label("stored", energy(r.stored))])], state);
    const consumers = rows.filter(r => r.kind === "machines" && r.consumers > 0);
    write(machine, 2, [...heading("consumption"), ...label("consumers", s.consumers), ...label("netLossRate", rate(s.netLoss)),
        ...(s.sampleTicks === null ? [text("needSamples"), "\n"] : label("sampleWindow", `${(s.sampleTicks / 20).toFixed(1)} s`)),
        "\n", ...heading("consumerDetails"), ...(consumers.length ? consumers.flatMap(r => [...name(r), ...activity(r), ...label("stored", energy(r.stored)), "\n"]) : [text("emptyCategory"), "\n"]),
        "\n", ...heading("distributionDetails"), ...label("relays", s.relays), ...label("distribution", rate(s.distribution)),
        ...groups("relays", r => [...activity(r), ...label("distribution", rate(r.distribution)), ...label("stored", energy(r.stored))])], state);
    write(machine, 3, [...heading("networkStorage"), ...storage(s), "\n", ...heading("storageByRole"),
        ...["batteries", "machines", "generators", "relays"].flatMap(kind => {
            const r = s.byKind[kind];
            return [...heading(kind), ...label("devices", r.count), ...storage(r), ...label("emptyBuffers", r.empty), ...label("fullBuffers", r.full), "\n"];
        }), ...heading("batteryTransfer"), ...label("transfer", rate(s.transfer)),
        "\n", ...heading("storageDetails"), ...rows.flatMap(r => [...name(r), ...storage(r),
            ...(r.kind === "batteries" ? label("transfer", rate(r.transfer)) : []), "\n"])], state);
}
registerATMachine(ID, {
    beforeOnPlayerPlace(event, { params }) {
        CoreMachine.spawnEntity(event, params, () => {
            const m = new Machine(event.block, { ...params, ignoreTick: true });
            if (m.valid) { prepareMonitor(m); m.blockSlots([0, 1, 2, 3, 4]); }
        });
    },
    onTick(event, { params }) {
        const m = new Machine(event.block, params);
        if (!m.valid) return;
        prepareMonitor(m);
        // Closed dashboards suspend collection; monitoring never needs energy.
        if (!m.shouldUpdateUI) { states.delete(m.entity.id); ButtonManager.unwatchEntity(m.entity); setRunning(m, false); return; }
        let state = states.get(m.entity.id);
        if (!state) {
            state = { monitor: new NetworkMonitor(m.block.location, { selfId: m.entity.id, block: p => m.dimension.getBlock(p), read: readEndpoint }), rendered: {}, nextScan: 0 };
            states.set(m.entity.id, state);
        }
        const tick = system.currentTick;
        if (state.monitor.scan || tick >= state.nextScan) {
            if (!state.monitor.scan) state.monitor.start();
            if (state.monitor.step(tick)) state.nextScan = tick + 100;
        }
        if (tick >= (state.nextRender ?? 0)) {
            render(m, state);
            state.nextRender = tick + 20;
        }
        ButtonManager.ensureWatching(m.entity, ID);
        setRunning(m, true);
    },
    onPlayerBreak(event) {
        const entity = event.block.dimension.getEntitiesAtBlockLocation(event.block.location).find(e => states.has(e.id));
        if (entity) { states.delete(entity.id); ButtonManager.unwatchEntity(entity); }
        Machine.onDestroy(event);
    },
});
