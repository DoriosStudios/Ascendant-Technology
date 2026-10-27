import { ItemStack } from "@minecraft/server";
import { ButtonManager, FluidStorage } from "DoriosCore/index.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
import { registerIOInterface } from "../../ATCore/machinery/ioRegistration.js";
import { ALCHEMY as C, ALCHEMY_SLOTS as S, ALCHEMY_UI } from "../../config/alchemy.js";
import { planBrewingBatch, resolvePotionUpgrade } from "../../ATCore/alchemy/recipes.js";
import { createPotion, readPotion, potionSignature } from "../../ATCore/alchemy/potions.js";
import { setRunning, setDynamicNumber, setDynamicString, setUiItem } from "./runtime.js";

const ID = "utilitycraft:alchemical_station";
const key = lane => `ascendant:alchemy_${lane}`;
const lanes = ["brew", "amplify", "extend"];
const progressSlots = [S.progress, S.amplifyProgress, S.extendProgress];

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: S.itemIO,
        anyInputSlots: [S.ingredient, S.fuel, ...S.bottles],
        anyOutputSlots: [33],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: S.bottles },
            { id: "input_2", inputSlots: [S.ingredient] },
            { id: "input_3", inputSlots: [S.fuel] },
            { id: "output_1", outputSlots: [33] },
        ],
    },
    liquids: {
        buttonSlots: S.fluidIO, anyInputIndices: [0], anyOutputIndices: [],
        modes: [{ id: "disabled" }, { id: "input_1", inputIndices: [0] }],
    },
});

for (const [lane, slot] of [["amplify", S.amplifyButton], ["extend", S.extendButton]]) {
    ButtonManager.registerMachineButton(ID, slot, ({ entity }) => {
        if (entity.getDynamicProperty(key(`${lane}_queued`))) return;
        const container = entity.getComponent("inventory")?.container;
        const item = container?.getItem(lane === "amplify" ? S.amplify : S.extend);
        if (!readPotion(item)) return;
        setDynamicString(entity, key(`${lane}_requested`), potionSignature(item));
        setDynamicNumber(entity, key(`${lane}_queued`), 1);
    });
}

registerATMachine(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const m = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!m.valid) return;
            m.blockSlots([S.blaze, S.aetherium, ...progressSlots]);
            configureTanks(m);
            for (let i = 0; i < lanes.length; i++) m.setProgress(0, C.brewTicks, { index: i, slot: progressSlots[i], display: false });
            setUiItem(m.container, S.amplifyButton, "utilitycraft:ui_filler", "§rAmplify · 1000 mB");
            setUiItem(m.container, S.extendButton, "utilitycraft:ui_filler", "§rExtend · 750 mB");
        });
    },
    onTick(event, { params: settings }) {
        const m = new Machine(event.block, settings);
        if (!m.valid || m.container.size !== S.size) return;
        const [aetherium, blaze] = configureTanks(m);
        m.processIO();
        if (m.shouldUpdateUI) ButtonManager.ensureWatching(m.entity, ID);
        else ButtonManager.unwatchEntity(m.entity);
        refillBlaze(m, blaze);
        const statuses = [];
        let running = false;
        for (let index = 0; index < lanes.length; index++) {
            const lane = lanes[index];
            const plan = buildPlan(m, lane);
            const result = processLane(m, lane, index, plan, aetherium, blaze);
            running ||= result.running;
            statuses.push(result.status);
        }
        if (m.shouldUpdateUI) {
            aetherium.display(S.aetherium);
            const frame = Math.min(ALCHEMY_UI.blazeFrames, Math.floor(ALCHEMY_UI.blazeFrames * blaze.get() / C.blazeCapacity));
            setUiItem(m.container, S.blaze, `${ALCHEMY_UI.blazeItemPrefix}${String(frame).padStart(2, "0")}`,
                `§rBlaze: ${blaze.get()} / ${C.blazeCapacity} mB`);
            const brewFrame = Math.min(28, Math.floor(28 * m.getProgress(0) / C.brewTicks));
            const brewMarker = `§0§a${String(brewFrame).padStart(2, "0").split("").map(d => `§${d}`).join("")}§r`;
            setUiItem(m.container, S.progress, "utilitycraft:ui_filler", `§rBrewing: ${Math.floor(100 * m.getProgress(0) / C.brewTicks)}%${brewMarker}`);
            for (let i = 1; i < lanes.length; i++) m.displayProgress(C.upgradeTicks, { slot: progressSlots[i], index: i });
        }
        setRunning(m, running);
        if (m.shouldUpdateUI) m.setLabel([
            `§r§eBrewing\n§r§f${statuses[0]}\n§r§7Reagent: middle slot\n§r§7Fuel: blaze powder\n§r§7Up to 6 bottles per batch`,
            `§r§eAmplify\n§r§f${statuses[1]}\n§r§7Left slot + left button\n§r§7Cost: ${C.amplifyCost} mB Aetherium`,
            `§r§eExtend\n§r§f${statuses[2]}\n§r§7Right slot + right button\n§r§7Cost: ${C.extendCost} mB Aetherium`,
            `§r§eStorage\n§r§fBlaze: ${blaze.get()} / ${C.blazeCapacity} mB\n§r§fAetherium: ${aetherium.get()} / ${C.aetheriumCapacity} mB\n§r§fEnergy: ${m.energy.get()} / ${m.energy.getCap()} DE`,
        ]);
    },
    onPlayerBreak(event) { Machine.onDestroy(event); },
});

function configureTanks(m) {
    const tanks = [new FluidStorage(m.entity, 0), new FluidStorage(m.entity, 1)];
    for (const [i, type, cap] of [[0, "liquified_aetherium", C.aetheriumCapacity], [1, "blaze_essence", C.blazeCapacity]]) {
        if (tanks[i].getType() !== type && tanks[i].get() === 0) tanks[i].setType(type);
        // Preserve stored contents when replacing a machine dropped with resources.
        if (tanks[i].getCap() !== Math.max(cap, tanks[i].get())) tanks[i].setCap(Math.max(cap, tanks[i].get()));
    }
    return tanks;
}

function refillBlaze(m, tank) {
    const item = m.container.getItem(S.fuel);
    if (item?.typeId !== "minecraft:blaze_powder" || tank.getType() !== "blaze_essence") return;
    const count = Math.min(item.amount, Math.floor(tank.getFreeSpace() / C.blazePerPowder));
    if (count <= 0) return;
    consume(m.container, S.fuel, item, count);
    tank.add(count * C.blazePerPowder);
}

function buildPlan(m, lane) {
    if (lane === "brew") {
        const ingredient = m.container.getItem(S.ingredient);
        if (!ingredient) return null;
        const bottles = S.bottles.map(slot => ({ slot, potion: readPotion(m.container.getItem(slot)) }));
        const plan = planBrewingBatch(bottles, ingredient.typeId);
        if (!plan) return null;
        const signature = [ingredient.typeId, ...S.bottles.map(slot => potionSignature(m.container.getItem(slot)))].join("|");
        return { ...plan, signature, ingredient, fluid: 0 };
    }
    const slot = lane === "amplify" ? S.amplify : S.extend;
    const item = m.container.getItem(slot);
    if (!m.entity.getDynamicProperty(key(`${lane}_queued`))) {
        const potion = readPotion(item);
        return potion && !resolvePotionUpgrade(potion, lane) ? { invalid: true } : null;
    }
    const signature = potionSignature(item);
    if (signature !== m.entity.getDynamicProperty(key(`${lane}_requested`))) {
        setDynamicNumber(m.entity, key(`${lane}_queued`), 0);
        return null;
    }
    const output = resolvePotionUpgrade(readPotion(item), lane);
    if (!output) {
        setDynamicNumber(m.entity, key(`${lane}_queued`), 0);
        return { invalid: true };
    }
    return { signature, changes: [{ slot, output }], ticks: C.upgradeTicks, energy: C.upgradeEnergy,
        fluid: lane === "amplify" ? C.amplifyCost : C.extendCost, blaze: 0 };
}

function processLane(m, lane, index, plan, aetherium, blaze) {
    const reset = () => { setDynamicNumber(m.entity, `dorios:progress_${index}`, 0); setDynamicString(m.entity, key(`${lane}_signature`), ""); };
    if (!plan || plan.invalid) {
        reset();
        const side = lane === "amplify" ? "left" : "right";
        const status = plan?.invalid ? (lane === "amplify" ? "No further level upgrade available." : "No longer duration available.")
            : lane === "brew" ? (!m.container.getItem(S.ingredient) ? "Add a reagent to the middle slot." : "Add bottles that match the reagent.")
            : readPotion(m.container.getItem(lane === "amplify" ? S.amplify : S.extend))
                ? `Press the ${side} button to start.` : `Insert a potion in the ${side} slot.`;
        return { running: false, status };
    }
    if (m.entity.getDynamicProperty(key(`${lane}_signature`)) !== plan.signature) {
        reset();
        setDynamicString(m.entity, key(`${lane}_signature`), plan.signature);
    }
    const effectiveEnergy = Math.ceil(plan.energy * m.boosts.consumption);
    if (m.energy.get() < effectiveEnergy) return { running: false, status: `Needs ${effectiveEnergy} DE` };
    if (plan.fluid && (aetherium.getType() !== "liquified_aetherium" || aetherium.get() < plan.fluid)) return { running: false, status: `Needs ${plan.fluid} mB Aetherium` };
    if (plan.blaze && (blaze.getType() !== "blaze_essence" || blaze.get() < plan.blaze)) return { running: false, status: "Needs blaze powder" };
    const bottleReturn = plan.ingredient?.typeId === "minecraft:dragon_breath";
    const returned = bottleReturn ? m.container.getItem(33) : undefined;
    if (bottleReturn && returned && (returned.typeId !== "minecraft:glass_bottle" || returned.amount >= returned.maxAmount)) return { running: false, status: "Remove returned glass bottles." };
    const progress = Math.min(plan.ticks, m.getProgress(index) + m.processingInterval * m.boosts.speed);
    setDynamicNumber(m.entity, `dorios:progress_${index}`, progress);
    if (progress < plan.ticks) return { running: true, status: `Processing: ${Math.floor(100 * progress / plan.ticks)}%` };
    // All outputs are constructible before any inventory, fluid or energy is consumed.
    let outputs;
    try { outputs = plan.changes.map(c => ({ slot: c.slot, item: createPotion(c.output) })); }
    catch (error) { return { running: false, status: `Unsupported potion: ${error.message}` }; }
    if (bottleReturn) {
        const bottle = returned ?? createEmptyBottle();
        if (returned) bottle.amount++;
        outputs.push({ slot: 33, item: bottle });
    }
    m.energy.consume(effectiveEnergy);
    if (plan.fluid) aetherium.consume(plan.fluid);
    if (plan.blaze) blaze.consume(plan.blaze);
    if (plan.ingredient) consume(m.container, S.ingredient, plan.ingredient, 1);
    for (const output of outputs) m.container.setItem(output.slot, output.item);
    reset();
    if (lane !== "brew") setDynamicNumber(m.entity, key(`${lane}_queued`), 0);
    return { running: true, status: `Finished (${outputs.length - (bottleReturn ? 1 : 0)} potion${outputs.length === 1 ? "" : "s"})` };
}

function createEmptyBottle() { return new ItemStack("minecraft:glass_bottle"); }
function consume(container, slot, item, amount) {
    if (item.amount <= amount) container.setItem(slot, undefined);
    else { item.amount -= amount; container.setItem(slot, item); }
}
