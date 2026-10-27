import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import { ItemStack } from "@minecraft/server";
import { RANGE, XP_CAP, DIRECTIONS, MODULES, rangeLevel, damageLevel, damageAt, clamp } from "./config.js";
import { save, valid } from "./state.js";
import { isCombatItem, serializeWeapon, deserializeWeapon } from "./weapon.js";

const raw = value => typeof value === "object" ? value : { text: String(value) };
const tr = (key, values = []) => {
    const message = { translate: `ui.utilitycraft.mob_slasher.${key}` };
    // Bedrock can serialize an empty rawtext array as {}, which is invalid in with.
    if (values.length) message.with = { rawtext: values.map(raw) };
    return message;
};
const lines = (...values) => ({ rawtext: values.flatMap((value, i) => i ? [{ text: "\n" }, raw(value)] : [raw(value)]) });
const sessions = new Set();
const moduleNames = ["mobMagnet", "xpMagnet", "teleporter", "storer"];
const cooldowns = [5, 10, 20, 30, 40];
const on = state => !!state.block.permutation.getState("utilitycraft:isOn");
const itemName = item => item?.nameTag ? { text: item.nameTag } : item?.localizationKey
    ? { translate: item.localizationKey } : item ? { text: item.typeId } : tr("none");
const unlock = name => tr(`unlock_${name}`, [itemName(new ItemStack(Object.keys(MODULES).find(id => MODULES[id] === name)))]);
function moduleStatus(state, name) {
    if (!state.modules[name]) return tr("locked");
    if (state.active[name] === false) return tr("disabled");
    if (!on(state)) return tr("paused_off");
    if (name === "storer" && state.xp >= XP_CAP) return tr("tank_full");
    if (name === "teleporter" && Math.min(state.distance, state.upgrades.range * 0.5) <= 0) return tr("paused_distance");
    return tr("enabled");
}
function summary(state) {
    return lines(
        tr("status_line", [tr(on(state) ? "enabled" : "disabled")]),
        tr("summary", [damageAt(damageLevel(state)), RANGE[rangeLevel(state)], itemName(state.weapon), state.xp, XP_CAP]),
    );
}
const xpStatus = state => tr(!state.modules.storer ? "locked" : state.active.storer === false ? "disabled"
    : !on(state) ? "paused_off"
    : state.xp >= XP_CAP ? "tank_full" : "enabled");
function destination(state, name) {
    const center = state.block.center();
    const distance = Math.min(state.distance, state.upgrades.range * 0.5);
    const direction = DIRECTIONS[state.direction];
    const offset = name === "xpMagnet" ? state.xpOffset ?? { x: 0, y: -0.4, z: 0 }
        : { x: direction.x * distance, y: direction.y * distance, z: direction.z * distance };
    return tr("target_xyz", ["x", "y", "z"].map(axis => Number((center[axis] + offset[axis]).toFixed(3))));
}

export async function openMain(player, state) {
    if (sessions.has(player.id) || !valid(state)) return;
    sessions.add(player.id);
    let notice;
    try {
        // Each response is checked against the revision it actually displayed.
        const show = async form => {
            const revision = state.revision;
            const response = await form.show(player);
            if (response.cancelationReason === FormCancelationReason.UserBusy) {
                player.sendMessage(tr("busy")); return { exit: true };
            }
            if (!valid(state) || state.revision !== revision) {
                player.sendMessage(tr("stale")); return { exit: true };
            }
            return response;
        };
        const commit = () => { save(state); state.revision++; notice = tr("saved"); };
        const body = (...content) => notice ? lines(...content, "", notice) : lines(...content);
        const entry = (title, detail) => tr("menu_entry", [tr(title), detail]);
        let page = "main";
        while (valid(state)) {
            let form, response;
            if (page === "main") {
                form = new ActionFormData().title(tr("title")).body(body(summary(state)))
                    .button(entry(on(state) ? "turn_off" : "turn_on", tr("status_line", [tr(on(state) ? "enabled" : "disabled")])))
                    .button(entry("settings", tr("settings_hint")), "textures/ui/at_icons/damage_upgrade")
                    .button(entry("weapon_menu", itemName(state.weapon)))
                    .button(entry("modules", tr("installed_count", [moduleNames.filter(name => state.modules[name]).length, 4])))
                    .button(entry("filters", tr("filter_summary", [tr(state.filterMode), state.filter.length])))
                    .button(entry("xp_menu", tr("xp_balance", [state.xp, XP_CAP])), "textures/items/tools/capsules/xp_capsule_1")
                    .button(tr("close"));
                response = await show(form);
                if (response.exit || response.canceled || response.selection === 6) break;
                if (response.selection === 0) {
                    state.block.setPermutation(state.block.permutation.withState("utilitycraft:isOn", !on(state)));
                    commit();
                    continue;
                }
                page = ["settings", "weapon", "modules", "filters", "xp"][response.selection - 1] ?? "main";
                notice = undefined;
                continue;
            }
            if (page === "settings") {
                form = new ModalFormData().title(tr("settings"))
                    .dropdown(tr("range"), RANGE.slice(0, state.upgrades.range + 1).map((radius, n) => tr("range_option", [n, radius])), { defaultValueIndex: rangeLevel(state) })
                    .dropdown(tr("damage"), Array.from({ length: state.upgrades.damage + 1 }, (_, n) => tr("damage_option", [n, damageAt(n)])), { defaultValueIndex: damageLevel(state), tooltip: tr("damage_hint") })
                    .submitButton(tr("apply"));
                response = await show(form);
                if (response.exit) break;
                if (!response.canceled && response.formValues) {
                    const [radius, damage] = response.formValues;
                    const r = clamp(radius, state.upgrades.range), d = clamp(damage, state.upgrades.damage);
                    state.range = r === state.upgrades.range ? undefined : r;
                    state.damage = d === state.upgrades.damage ? undefined : d;
                    commit();
                }
                page = "main";
            } else if (page === "weapon") {
                const durability = state.weapon?.getComponent("minecraft:durability");
                const description = [tr("weapon_hint"), "", state.weapon ? itemName(state.weapon) : tr("weapon_empty")];
                if (durability) description.push(tr("durability", [durability.maxDurability - durability.damage, durability.maxDurability]));
                if (state.weapon) description.push(...state.weapon.getLore());
                const installed = !!state.weapon;
                form = new ActionFormData().title(tr("weapon_menu")).body(body(...description))
                    .button(tr(installed ? "weapon_remove" : "weapon_insert")).button(tr("back"));
                response = await show(form);
                if (response.exit) break;
                if (response.canceled || response.selection !== 0) { page = "main"; continue; }
                // Combat may break a weapon while the form is open without a config revision.
                if (installed !== !!state.weapon) { notice = tr("stale"); continue; }
                if (installed) {
                    const inventory = player.getComponent("minecraft:inventory")?.container;
                    if (!inventory || inventory.emptySlotsCount <= 0) { notice = tr("inventory_full"); continue; }
                    if (inventory.addItem(state.weapon)) { notice = tr("inventory_full"); continue; }
                    state.weapon = undefined;
                } else {
                    const equipment = player.getComponent("minecraft:equippable");
                    const item = equipment?.getEquipment("Mainhand");
                    if (!isCombatItem(item)) { notice = tr("invalid_weapon"); continue; }
                    deserializeWeapon(serializeWeapon(item));
                    state.weapon = item.clone();
                    try { save(state); } catch (error) { state.weapon = undefined; throw error; }
                    if (!equipment.setEquipment("Mainhand", undefined)) {
                        state.weapon = undefined; save(state); notice = tr("transfer_failed"); continue;
                    }
                }
                commit();
            } else if (page === "modules") {
                form = new ActionFormData().title(tr("modules")).body(body(tr("unlock_hint")));
                for (const name of moduleNames) form.button(entry(`module_${name}`, moduleStatus(state, name)));
                form.button(tr("back"));
                response = await show(form);
                if (response.exit) break;
                const name = moduleNames[response.selection];
                if (response.canceled || !name) { page = "main"; continue; }
                if (!state.modules[name]) { notice = unlock(name); continue; }
                page = name; notice = undefined;
            } else if (moduleNames.includes(page)) {
                const name = page;
                if (!state.modules[name]) { page = "modules"; continue; }
                const description = [tr("enabled"), tr(`hint_${name}`)];
                if (name === "xpMagnet" || name === "teleporter") description.push(destination(state, name));
                form = new ModalFormData().title(tr(`module_${name}`))
                    .toggle(lines(...description), { defaultValue: state.active[name] !== false });
                if (name === "mobMagnet") form.dropdown(tr("magnet_cooldown"), cooldowns.map(n => tr("ticks_option", [n])), { defaultValueIndex: Math.max(0, cooldowns.indexOf(Math.max(5, state.cooldown ?? 5))) });
                if (name === "teleporter") form
                    .dropdown(tr("direction"), DIRECTIONS.map(d => tr(`direction_${d.name.toLowerCase()}`)), { defaultValueIndex: state.direction })
                    .dropdown(tr("distance"), Array.from({ length: state.upgrades.range + 1 }, (_, n) => tr("blocks_option", [n * 0.5])), { defaultValueIndex: clamp(state.distance * 2, state.upgrades.range) });
                if (name === "xpMagnet") {
                    const offset = state.xpOffset ?? { x: 0, y: -0.4, z: 0 };
                    for (const axis of ["x", "y", "z"]) form.textField(tr(`xp_offset_${axis}`), "0", { defaultValue: String(offset[axis]) });
                }
                if (name === "storer") form.toggle(tr("pause_full"), { defaultValue: state.pauseFull !== false, tooltip: tr("overflow_hint") });
                form.submitButton(tr("apply"));
                response = await show(form);
                if (response.exit) break;
                if (!response.canceled && response.formValues) {
                    const [enabled, ...values] = response.formValues;
                    if (name === "xpMagnet") {
                        const numbers = values.map(value => String(value).trim()).map(value => value === "" ? NaN : Number(value.replace(",", ".")));
                        if (numbers.length !== 3 || numbers.some(n => !Number.isFinite(n))) { notice = tr("invalid_offset"); page = "modules"; continue; }
                        state.xpOffset = { x: numbers[0], y: numbers[1], z: numbers[2] };
                    }
                    if (name === "teleporter") { state.direction = clamp(values[0], 5); state.distance = clamp(values[1], state.upgrades.range) * 0.5; }
                    if (name === "mobMagnet") state.cooldown = cooldowns[clamp(values[0], cooldowns.length - 1)];
                    if (name === "storer") state.pauseFull = !!values[0];
                    state.active[name] = !!enabled;
                    commit();
                }
                page = "modules";
            } else if (page === "filters") {
                form = new ModalFormData().title(tr("filters"))
                    .dropdown(lines(tr("filter_mode"), tr("filter_hint")), [tr("blacklist"), tr("whitelist")], { defaultValueIndex: state.filterMode === "whitelist" ? 1 : 0 })
                    .textField(tr("filter_ids"), "minecraft:zombie, minecraft:skeleton", { defaultValue: state.filter.join(", ") })
                    .submitButton(tr("apply"));
                response = await show(form);
                if (response.exit) break;
                if (!response.canceled && response.formValues) {
                    const [mode, text] = response.formValues;
                    const ids = String(text ?? "").split(/[\s,]+/).filter(Boolean);
                    if (ids.some(id => !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id))) notice = tr("invalid_filter");
                    else { state.filterMode = mode === 1 ? "whitelist" : "blacklist"; state.filter = [...new Set(ids)]; commit(); }
                }
                page = "main";
            } else if (page === "xp") {
                const canWithdraw = !!state.modules.storer && state.xp > 0;
                form = new ActionFormData().title(tr("xp_menu")).body(body(
                    tr("xp_balance", [state.xp, XP_CAP]), tr("status_line", [xpStatus(state)]), tr("hint_storer"),
                    state.modules.storer ? tr("overflow_hint") : unlock("storer"),
                ));
                const amounts = canWithdraw ? [100, 1000, Infinity] : [];
                for (const amount of amounts) form.button(amount === Infinity ? tr("xp_all") : tr("xp_withdraw", [amount]));
                form.button(tr("back"));
                response = await show(form);
                if (response.exit) break;
                const amount = amounts[response.selection];
                if (response.canceled || amount === undefined) { page = "main"; continue; }
                const taken = Math.min(state.xp, amount);
                if (taken > 0 && state.modules.storer) {
                    player.addExperience(taken); state.xp -= taken; save(state);
                    notice = tr("xp_taken", [taken]);
                }
            }
        }
    } catch (error) {
        console.warn("[Mob Slasher] Form failed:", error);
        try { player.sendMessage(tr("error")); }
        catch (notificationError) { console.warn("[Mob Slasher] Error notification failed:", notificationError); }
    } finally { sessions.delete(player.id); }
}
