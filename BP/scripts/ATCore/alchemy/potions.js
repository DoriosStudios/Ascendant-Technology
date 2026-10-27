import { ItemStack, Potions } from "@minecraft/server";
import { CUSTOM_POTIONS, NATIVE_POTIONS, POTION_FAMILIES, formatPotionDuration, potionItemId } from "../../config/alchemy.js";

const deliveries = { drink: "Consume", splash: "ThrownSplash", lingering: "ThrownLingering" };
const forms = Object.fromEntries(Object.entries(deliveries).map(([k, v]) => [v, k]));
const DURATION_KEY = "ascendant:potion_duration";
const LONG_DURATION_KEY = "ascendant:potion_long_duration";

export function readPotion(item) {
    if (!item || item.amount !== 1) return null;
    const custom = CUSTOM_POTIONS[item.typeId];
    if (custom) {
        const exact = item.getDynamicProperty(DURATION_KEY);
        const long = item.getDynamicProperty(LONG_DURATION_KEY);
        return { ...custom, ...(typeof exact === "number" && exact >= 0 ? { duration: exact } : {}),
            ...(typeof long === "number" && long > 0 ? { longDuration: long } : {}) };
    }
    const component = item.getComponent("minecraft:potion");
    if (!component) return null;
    const id = component.potionEffectType.id;
    const form = forms[component.potionDeliveryType.id];
    if (!form) return null;
    const native = NATIVE_POTIONS[id];
    if (native) {
        const f = POTION_FAMILIES.find(f => f.id === native.family);
        const ticks = component.potionEffectType.durationTicks;
        // Prefer the live registry over catalog defaults if vanilla balance changes.
        const longTicks = f.native && f.nativeLong !== false
            ? Potions.getEffectType?.(`minecraft:long_${f.native}`)?.durationTicks : undefined;
        return { ...native, form, ...(typeof ticks === "number" && ticks >= 0 ? { duration: ticks / 20 } : {}),
            ...(typeof longTicks === "number" && longTicks > 0 ? { longDuration: longTicks / 20 } : {}) };
    }
    const foundation = id.replace("minecraft:", "");
    if (["water", "awkward", "mundane", "long_mundane", "thick"].includes(foundation)) {
        return { family: foundation === "long_mundane" ? "mundane" : foundation, level: 1, extent: "normal", form };
    }
    return null;
}

export function createPotion(p) {
    const f = POTION_FAMILIES.find(f => f.id === p.family);
    if (!f) return Potions.resolve(`minecraft:${p.family}`, deliveries[p.form]);
    // Preserve ordinary native recipes; use custom items when tier/duration has no native equivalent.
    const prefix = p.extent === "long" ? "long_" : p.level === (f.strongLevel ?? 2) ? "strong_" : "";
    const native = f.native && p.extent !== "maximum" && (
        (p.level === 1 && (p.extent === "normal" || f.nativeLong !== false)) ||
        (p.extent === "normal" && f.strong !== undefined && p.level === (f.strongLevel ?? 2) && p.duration === f.strong)
    );
    const canonicalDuration = p.extent === "long" ? f.long : f.normal;
    if (native && (p.duration === undefined || p.duration === (prefix === "strong_" ? f.strong : canonicalDuration))) {
        return Potions.resolve(`minecraft:${prefix}${f.native}`, deliveries[p.form]);
    }
    const item = new ItemStack(potionItemId(p));
    if (p.duration !== undefined) item.setDynamicProperty(DURATION_KEY, p.duration);
    if (p.longDuration !== undefined) item.setDynamicProperty(LONG_DURATION_KEY, p.longDuration);
    // Tooltip estimates are localized in the display name; exact gameplay durations stay in properties.
    return item;
}

export function formatDuration(seconds) {
    return formatPotionDuration(seconds);
}

export function potionSignature(item) {
    return item ? `${item.typeId}:${item.amount}:${JSON.stringify(readPotion(item))}` : "empty";
}
