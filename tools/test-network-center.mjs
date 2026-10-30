import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { NetworkMonitor, monitorMessage, monitorLorePages } from "../BP/scripts/ATCore/networks/networkMonitor.js";

const noButtons = { activeWatchers: new Map(), registerMachineButton() {}, ensureWatching() {}, unwatchEntity() {} };
class LoreStack {
    constructor(typeId = "utilitycraft:ui_filler") { this.typeId = typeId; }
    setLore(lines) {
        assert(lines.length <= 100, `Lore line count: ${lines.length}`);
        for (const line of lines) assert(Buffer.byteLength(typeof line === "string" ? line : JSON.stringify(line), "utf8") <= 1000, "Lore entry too long");
        this.lore = lines;
    }
}
const loreParts = item => item.lore.flatMap(line => typeof line === "string" ? [{ text: line }] : line.rawtext);

const key = p => `${p.x},${p.y},${p.z}`;
function fixture() {
    const blocks = new Map(), entries = new Map(); let lookups = 0;
    function put(x, y, type, tags = [], states = {}) {
        const location = { x, y, z: 0 };
        const block = { location, typeId: type, hasTag: t => t === "dorios:energy" || tags.includes(t), permutation: { getState: face => states[face] ?? true } };
        blocks.set(key(location), block); return block;
    }
    const root = put(0, 0, "utilitycraft:network_center");
    const monitor = new NetworkMonitor(root.location, { block: p => { lookups++; return blocks.get(key(p)) ?? { hasTag: () => false }; }, read: b => entries.get(key(b.location)) });
    return { blocks, entries, put, monitor, calls: () => lookups };
}
const endpoint = (id, kind = "machines", stored = 10) => ({ id, kind, stored, capacity: 100, generation: kind === "generators" ? 20 : 0, transfer: kind === "batteries" ? 50 : 0 });
function finish(m, tick = 100) { let steps = 0; while (!m.step(tick, 32)) { if (++steps > 10000) throw Error("scan did not finish"); } return m.snapshot; }

test("large networks have no machine/type cutoff; scanning yields and does not retain traversal buffers", () => {
    const f = fixture();
    for (let x = 1; x <= 1200; x++) {
        f.put(x, 0, "utilitycraft:energy_cable", ["dorios:isTube"]);
        f.put(x, 1, `test:machine_${x}`); f.entries.set(`${x},1,0`, endpoint(`machine_${x}`));
    }
    assert.equal(f.monitor.step(1, 16), false); assert(f.calls() <= 16 * 7);
    const s = finish(f.monitor); assert.equal(s.machines, 1200); assert.equal(s.types.size, 1200); assert.equal(s.cables, 1200);
    assert.equal(s.stored, 12000); assert.equal(s.capacity, 120000); assert.equal(s.queue, undefined);
    const message = monitorMessage([...s.types.keys()].map(k => k + "\n"));
    assert(message.rawtext.map(p => p.text ?? "").join("").length > 255);
    assert(message.rawtext.some(p => p.text.includes("machine_1200")));
});
test("closed cable faces and endpoint machines do not bridge unrelated grids", () => {
    const f = fixture();
    f.put(1, 0, "utilitycraft:energy_cable", ["dorios:isTube"], { "utilitycraft:east": false });
    f.put(2, 0, "test:hidden"); f.entries.set("2,0,0", endpoint("hidden"));
    f.put(0, 1, "test:endpoint"); f.entries.set("0,1,0", endpoint("end"));
    f.put(0, 2, "utilitycraft:energy_cable", ["dorios:isTube"]);
    assert.equal(finish(f.monitor).machines, 1); assert.equal(f.monitor.snapshot.cables, 1);
});
test("cycles and multiple physical endpoints count the same entity only once", () => {
    const f = fixture();
    for (const [x, y] of [[1,0],[1,1],[0,1]]) f.put(x,y,"utilitycraft:energy_cable",["dorios:isTube"]);
    for (const [x,y] of [[2,0],[2,1]]) { f.put(x,y,"test:link"); f.entries.set(`${x},${y},0`, endpoint("shared", "batteries", 50)); }
    const s=finish(f.monitor); assert.equal(s.batteries,1); assert.equal(s.batteryCapacity,100); assert.equal(s.transfer,50);
});
test("generation, batteries and storage deltas are separate and topology changes reset the delta", () => {
    const f=fixture(); f.put(1,0,"test:generator"); const e=endpoint("gen","generators",50); f.entries.set("1,0,0",e);
    assert.equal(finish(f.monitor,100).generation,20); e.stored=70; assert.equal(finish(f.monitor,120).delta,1);
    e.id="replacement"; assert.equal(finish(f.monitor,140).delta,null); assert.equal(f.monitor.snapshot.batteries,0);
});
test("unloaded blocks are reported, never loaded or altered by the monitor", () => {
    const m=new NetworkMonitor({x:0,y:0,z:0},{block(){throw Error("unloaded");},read(){throw Error("unexpected");}});
    assert.equal(m.step(1),true); assert.equal(m.snapshot.unavailable,1);
});
test("long RawMessage text is lossless, translations are preserved and fragments stay short", () => {
    const text="0123456789".repeat(1200), localized={translate:"test.name"};
    const result=monitorMessage([text,localized]); assert.equal(result.rawtext.slice(0,-1).map(p=>p.text).join(""),text);
    assert(result.rawtext.slice(0,-1).every(p=>p.text.length<=200)); assert.equal(result.rawtext.at(-1),localized);
    const unicode="x".repeat(199)+"💠§a"+"y".repeat(400);
    const chunks=monitorMessage([unicode]).rawtext.map(p=>p.text);
    assert.equal(chunks.join(""),unicode);
    assert(chunks.every(s=>!/[\uD800-\uDBFF§]$/.test(s)));
});

test("actual endpoint reader distinguishes consumers, batteries, generators and linked owners", () => {
    const env=vm.createContext({NetworkMonitor,monitorMessage,monitorLorePages,ButtonManager:noButtons,system:{},world:{afterEvents:{entityRemove:{subscribe(){}}}},
        EnergyStorage:class{constructor(e){return e.storage;}},registerATMachine(){},
        isLinkNode:b=>!!b.linked,resolveLinkNode:b=>({entity:b.linked}),setRunning(){}});
    vm.runInContext(readFileSync('BP/scripts/features/machines/networkCenter.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,''),env);
    function block(id,kind){const b={typeId:id,location:{x:0,y:0,z:0},hasTag:t=>t==='dorios:machine'&&kind==='machine',
        getComponent:k=>kind==='battery'&&k==='utilitycraft:battery'?{customComponentParameters:{params:{rate_speed_base:100}}}:undefined,
        getComponents:()=>kind==='generator'?[{customComponentParameters:{params:{generator:{rate_speed_base:25}}}}]:[]};
        const e={id,isValid:true,location:b.location,storage:{get:()=>50,getCap:()=>100},getComponent:()=>({hasTypeFamily:f=>f==='dorios:energy_container'||f==='dorios:energy_source'&&kind!=='machine'})};
        b.dimension={getEntitiesAtBlockLocation:()=>[e]};e.dimension={getBlock:()=>b};return {b,e};}
    for(const [kind,expected]of [['machine','machines'],['battery','batteries'],['generator','generators']]){
        const {b,e}=block('test:'+kind,kind),r=env.readEndpoint(b);assert.equal(r.kind,expected);assert.equal(r.stored,50);
        if(kind==='battery')assert.equal(r.transfer,100);
        if(kind==='generator')assert.equal(r.generation,25);
        assert.equal(env.readEndpoint({linked:e}).type,b.typeId);
    }
});
test("actual runtime migrates old energy helpers, scans without power and suspends closed dashboards", () => {
    let component, current; const handlers={};
    const env=vm.createContext({NetworkMonitor,monitorMessage,monitorLorePages,ButtonManager:noButtons,ItemStack:LoreStack,EnergyStorage:{formatEnergyToText:String},
        system:{currentTick:0},world:{afterEvents:{entityRemove:{subscribe(fn){handlers.remove=fn;}}}},isLinkNode:()=>false,resolveLinkNode:()=>undefined,
        Machine:class{constructor(){return current;}},registerATMachine:(_,c)=>component=c,setRunning(){}});
    vm.runInContext(readFileSync('BP/scripts/features/machines/networkCenter.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,''),env);
    const f=fixture(); for(let x=1;x<160;x++)f.put(x,0,"utilitycraft:energy_cable",["dorios:isTube"]);
    let stored=800000,capacity=800000,writes=0,energyFamily=true; const items=new Map([[5,{typeId:'utilitycraft:energy_48'}]]);
    current={valid:true,shouldUpdateUI:false,block:{location:{x:0,y:0,z:0}},dimension:{getBlock:p=>f.blocks.get(key(p))??{hasTag:()=>false}},
        entity:{id:'monitor',typeId:'utilitycraft:machine_entity',getComponent:()=>({hasTypeFamily:f=>f==='dorios:energy_container'&&energyFamily}),
            triggerEvent(event){assert.equal(event,'utilitycraft:container');energyFamily=false;}},
        energy:{get:()=>stored,getCap:()=>capacity,set:v=>stored=v,setCap:v=>capacity=v,consume(){assert.fail('passive monitor must not consume energy');},display(){assert.fail('no energy display');}},
        container:{getItem:k=>items.get(k),setItem(k,v){writes++;if(v)items.set(k,v);else items.delete(k);}},
        blockSlots(slots){for(const slot of slots)if(!items.has(slot))this.container.setItem(slot,{typeId:'utilitycraft:blocked_slot'});}};
    const tick=()=>component.onTick({}, {params:{}});
    tick(); assert.equal(stored,0);assert.equal(capacity,0);assert.equal(energyFamily,false);assert.equal(items.get(5).typeId,'utilitycraft:blocked_slot');
    const unexpected={typeId:'minecraft:diamond',amount:3};items.set(5,unexpected);tick();assert.equal(items.get(5),unexpected,'unexpected real items must survive migration');
    current.shouldUpdateUI=true;tick();
    for(let t=4;t<=40;t+=4){env.system.currentTick=t;tick();}
    assert(items.get(1),'unpowered monitor must finish a multi-step scan');assert.equal(capacity,0);assert.equal(stored,0);
    const first=vm.runInContext('states.get("monitor").monitor.snapshot.tick',env);
    env.system.currentTick=first+100;tick();
    for(let t=4;t<=40;t+=4){env.system.currentTick=first+100+t;tick();}
    assert(vm.runInContext('states.get("monitor").monitor.snapshot.tick',env)>first,'rescans require no charge');
    current.shouldUpdateUI=false;const before=writes;tick();assert.equal(writes,before);
    assert.equal(vm.runInContext('states.has("monitor")',env),false);
    handlers.remove({removedEntityId:'monitor'});
});

test('new placement uses a zero-capacity container and retains its six-slot identity', () => {
    const params=JSON.parse(readFileSync('BP/blocks/machinery/machines/network_center.json','utf8'))['minecraft:block'].components['utilitycraft:network_center'];
    let component, placement;
    const env=vm.createContext({NetworkMonitor,monitorMessage,monitorLorePages,ButtonManager:noButtons,system:{},world:{afterEvents:{entityRemove:{subscribe(){}}}},
        CoreMachine:{spawnEntity(event,config){placement={event,config};}},registerATMachine:(_,c)=>component=c});
    vm.runInContext(readFileSync('BP/scripts/features/machines/networkCenter.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,''),env);
    const event={};component.beforeOnPlayerPlace(event,{params});
    assert.equal(placement.event,event);assert.equal(placement.config.entity.type,'container');assert.equal(placement.config.entity.inventory_size,6);
    assert.equal(placement.config.machine.energy_cap,0);assert.equal(placement.config.machine.energy_cost,0);
});


function mixedNetwork() {
    const f = fixture();
    const definitions = [
        { ...endpoint('producer', 'generators', 50), type: 'test:producer', active: true },
        { ...endpoint('consumer', 'machines', 40), type: 'test:consumer', active: false, consumer: true },
        { ...endpoint('battery', 'batteries', 60), type: 'test:battery', active: null },
        { ...endpoint('relay', 'relays', 70), type: 'utilitycraft:basic_power_beacon', active: true, distribution: 1000 },
        { ...endpoint('free', 'machines', 10), type: 'test:free_storage', active: false, consumer: false },
    ];
    definitions.forEach((entry, i) => {
        f.put(i + 1, 0, 'utilitycraft:energy_cable', ['dorios:isTube']);
        f.put(i + 1, 1, entry.type); f.entries.set(`${i + 1},1,0`, entry);
    });
    return { ...f, definitions };
}

test('category totals separate production, consumers, distribution and all four storage roles', () => {
    const f = mixedNetwork(), s = finish(f.monitor, 100);
    assert.equal(s.generation, 20); assert.equal(s.activeGeneration, 20);
    assert.equal(s.distribution, 1000); assert.equal(s.transfer, 50);
    assert.equal(s.generators, 1); assert.equal(s.relays, 1); assert.equal(s.machines, 2); assert.equal(s.consumers, 1);
    assert.equal(s.stored, 230); assert.equal(s.capacity, 500);
    assert.equal(s.byKind.machines.stored, 50); assert.equal(s.byKind.batteries.stored, 60);
    assert.equal(s.byKind.generators.stored, 50); assert.equal(s.byKind.relays.stored, 70);
    assert.equal(s.byKind.batteries.unknown, 1); assert.equal(s.byKind.relays.active, 1);
    assert.equal(s.netGain, null); assert.equal(s.netLoss, null);
    f.definitions[2].stored = 100; f.definitions[1].stored = 0;
    const updated = finish(f.monitor, 120);
    assert.equal(updated.byKind.batteries.full, 1); assert.equal(updated.byKind.machines.empty, 1);
});

test('net gains/losses cancel internal transfers and suppress incomplete or changed-network samples', () => {
    const f = mixedNetwork(); finish(f.monitor, 100);
    f.definitions[0].stored -= 10; f.definitions[1].stored += 10;
    let s = finish(f.monitor, 120); assert.equal(s.netGain, 0); assert.equal(s.netLoss, 0);
    f.definitions[0].stored += 40;
    s = finish(f.monitor, 140); assert.equal(s.netGain, 2); assert.equal(s.netLoss, 0); assert.equal(s.sampleTicks, 20);
    f.definitions[1].stored -= 20;
    s = finish(f.monitor, 160); assert.equal(s.netGain, 0); assert.equal(s.netLoss, 1);
    // A different traversal order or Link Node location must not fabricate a topology change.
    const a = f.entries.get('1,1,0'), b = f.entries.get('2,1,0');
    f.entries.set('1,1,0', b); f.entries.set('2,1,0', a);
    s = finish(f.monitor, 180); assert.equal(s.netGain, 0); assert.equal(s.netLoss, 0);
    const read = f.monitor.adapter.block;
    f.monitor.adapter.block = pos => { if (key(pos) === '1,-1,0') throw Error('unloaded'); return read(pos); };
    s = finish(f.monitor, 200); assert.equal(s.unavailable, 1); assert.equal(s.netGain, null); assert.equal(s.netLoss, null);
    f.monitor.adapter.block = read;
    assert.equal(finish(f.monitor, 220).delta, null, 'first complete sample after an incomplete one is not comparable');
    assert.equal(finish(f.monitor, 240).delta, 0);
    f.definitions[0].id = 'replacement'; assert.equal(finish(f.monitor, 260).delta, null);
});

test('a Link Node pointing back to the Center does not count its own buffer', () => {
    const f = fixture(); f.monitor.adapter.selfId = 'self';
    f.put(1, 0, 'test:link'); f.entries.set('1,0,0', endpoint('self'));
    const s = finish(f.monitor); assert.equal(s.members.length, 0); assert.equal(s.stored, 0);
});

test('real endpoint reader classifies Beacons as distribution and excludes zero-cost machines from consumers', () => {
    const env = vm.createContext({ NetworkMonitor, monitorMessage, monitorLorePages, ButtonManager: noButtons, system: {}, world: { afterEvents: { entityRemove: { subscribe() {} } } },
        EnergyStorage: class { constructor(e) { return e.storage; } }, registerATMachine() {}, isLinkNode: () => false });
    vm.runInContext(readFileSync('BP/scripts/features/machines/networkCenter.js', 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, ''), env);
    const entity = { id: 'beacon', isValid: true, storage: { get: () => 42, getCap: () => 128000 }, getComponent: () => ({ hasTypeFamily: f => ['dorios:machine', 'dorios:energy_container', 'dorios:energy_source'].includes(f) }) };
    const block = { typeId: 'utilitycraft:basic_power_beacon', location: {x:0,y:0,z:0}, dimension: { getEntitiesAtBlockLocation: () => [entity] },
        getComponent() {}, hasTag: () => false, permutation: { getState: () => true },
        getComponents: () => [{ customComponentParameters: { params: { generator: { rate_speed_base: 1000 } } } }] };
    let r = env.readEndpoint(block); assert.equal(r.kind, 'relays'); assert.equal(r.generation, 0); assert.equal(r.distribution, 1000); assert.equal(r.active, true);
    block.typeId = 'test:free'; block.hasTag = t => t === 'dorios:machine';
    block.getComponents = () => [{ customComponentParameters: { params: { machine: { energy_cost: 0, rate_speed_base: 25600000 } } } }];
    r = env.readEndpoint(block); assert.equal(r.kind, 'machines'); assert.equal(r.consumer, false);
});

test('actual presenter keeps each category in its own slot and clears stale pages while awaiting the first scan', () => {
    const env = vm.createContext({ NetworkMonitor, monitorMessage, monitorLorePages, ButtonManager: noButtons, system: { currentTick: 120 }, world: { afterEvents: { entityRemove: { subscribe() {} } } },
        EnergyStorage: { formatEnergyToText: String }, ItemStack: LoreStack, registerATMachine() {} });
    vm.runInContext(readFileSync('BP/scripts/features/machines/networkCenter.js', 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, ''), env);
    const f = mixedNetwork(); finish(f.monitor, 100); const items = new Map();
    const machine = { container: { setItem: (i, item) => items.set(i, item) } }, state = { monitor: f.monitor, rendered: {} };
    env.render(machine, state);
    const keys = slot => loreParts(items.get(slot)).filter(p => p.translate).map(p => p.translate.replace('ui.ascendant:network.', ''));
    assert(keys(0).includes('connectedTypes')); assert(!keys(0).includes('storageDetails'));
    assert(keys(1).includes('generation')); assert(!keys(1).includes('distribution'));
    assert(keys(2).includes('consumerDetails')); assert(keys(2).includes('distribution')); assert(!keys(2).includes('generation'));
    assert(keys(3).includes('storageDetails')); assert(keys(3).includes('batteryTransfer')); assert(!keys(3).includes('netLossRate'));
    assert(keys(4).includes('ready')); assert(!keys(4).includes('monitorEnergy')); assert(!keys(4).includes('noEnergy'));
    for (let slot = 0; slot < 4; slot++) for (const note of ['scope','help','gainsNote','lossesNote','sampleNote','capacityNote']) {
        assert(!keys(slot).includes(note), `removed end-of-page description: ${note}`);
    }
    const lossIds = loreParts(items.get(2)).filter(p => p.translate?.startsWith('tile.')).map(p => p.translate);
    assert(!lossIds.includes('tile.test:free_storage.name')); assert(lossIds.includes('tile.test:consumer.name'));
    // Unchanged category payloads are not rewritten just because the footer age advances.
    let writes = []; machine.container.setItem = (i, item) => { writes.push(i); items.set(i,item); };
    env.system.currentTick += 20; env.render(machine, state); assert.deepEqual(writes, [4]);
    state.monitor = { snapshot: null, scan: { head: 1, queue: [1,2] } }; env.render(machine, state);
    for (let i = 0; i < 4; i++) assert(keys(i).includes('waiting'));
    assert(keys(4).includes('scanning'));
});

test('four UI tabs share an exclusive radio group and map directly to the four category slots', () => {
    const ui = JSON.parse(readFileSync('RP/ui/network_center.json','utf8'));
    const root = ui.utility_panel.controls.find(c => c['root_panel@common.root_panel'])['root_panel@common.root_panel'];
    assert.deepEqual(root.size, ['100%', '100%']);
    const controls = root.controls[0].dashboard.controls;
    assert.deepEqual(root.controls[0].dashboard.max_size, [250,166]);
    assert.equal(ui['view_top_bar@at_common.button_card'].$card_buttons_ref, 'network_center.button_card_buttons');
    assert.equal(ui['view_top_bar@at_common.button_card'].$card_selected_tab, 0);
    assert.deepEqual(ui['view_top_bar@at_common.button_card'].$card_size, ['100%c',27]);
    assert.deepEqual(ui['view_top_bar@at_common.button_card'].$card_offset, [0,4]);
    assert(!ui['page@at_common.tab_content'].controls.some(c => c.description || c.page_title));
    const header = ui['page@at_common.tab_content'].controls.find(c=>c.header).header;
    assert.equal(header.type, 'stack_panel'); assert.equal(header.size[0], '100%c');
    const next = header.controls.find(c=>c.next_page).next_page;
    const button = next.controls[0]['button@common_buttons.light_text_form_fitting_button'];
    assert(button); assert.equal(button.$pressed_button_name, 'button.drop_all');
    assert.equal(button.collection_index, '$page_slot');
    assert(!JSON.stringify(header).includes('enable_text_wrap'));
    assert(!JSON.stringify(header).includes('100%s'), 'header must not depend on sibling-size feedback');
    assert(!JSON.stringify(ui).includes('"modifications"'), 'native inherited scrolling content must not contain runtime modifications');
    assert.equal(ui['page@at_common.tab_content'].bindings[0].resolve_sibling_scope, false);
    const buttons = ui['button_card_buttons@at_core.button_card_row'].controls;
    for (const [index, name] of ['overview','gains','losses','capacity'].entries()) {
        const tab = buttons.find(c => c[`${name}_tab@at_common.card_tab`])[`${name}_tab@at_common.card_tab`];
        const page = controls.find(c => c[`${name}_page@network_center.page`])[`${name}_page@network_center.page`];
        assert.equal(tab.$card_tab_index,index); assert.equal(tab.$toggle_name,"network_center_pages"); assert.equal(page.$tab_control,`${name}_tab`);
        assert.equal(page.$page_content,`network_center.${name}_content`);
        assert.equal(ui[`${name}_content@network_center.compact_info`].$label_index,index);
    }
});


test('lore packing splits complete entries, keeps translation tokens, Unicode and line boundaries', () => {
    const source = ['§bHeader\n', 'x'.repeat(1550), '\n§7', {translate:'test.name'}, '\n', '💠漢字§a'.repeat(800)];
    const pages = monitorLorePages(source);
    assert(pages.flat().length > 1);
    const stack = new LoreStack();
    for (const page of pages) stack.setLore(page);
    const parts = pages.flat().flatMap(line => line.rawtext.slice(1)); // Skip per-entry default formatting.
    assert(parts.some(p => p.translate === 'test.name'));
    const rawText = parts.filter(p => p.text !== undefined).map(p=>p.text).join('');
    assert.equal(rawText.replace(/\n/g,''), source.filter(p=>typeof p==='string').join('').replace(/\n/g,''));
    assert(parts.filter(p=>p.text).every(p=>!/[\uD800-\uDBFF§]$/.test(p.text)));
    const text = monitorLorePages(['First\n\nSecond\nThird']);
    assert.equal(text[0][0].rawtext.slice(1).map(p=>p.text).join(''),'First\n\nSecond\nThird');
});

test('actual writer respects both API lore bounds and paginates 1200 types without dropping any', () => {
    const handlers = new Map(), jobs = [], buttons = { ...noButtons, registerMachineButton: (_, slot, fn) => handlers.set(slot, fn) };
    const env = vm.createContext({ NetworkMonitor, monitorMessage, monitorLorePages, ButtonManager: buttons, ItemStack: LoreStack,
        EnergyStorage: {formatEnergyToText:String}, system:{currentTick:120,run:fn=>jobs.push(fn)},
        world:{afterEvents:{entityRemove:{subscribe(){}}}},registerATMachine(){} });
    vm.runInContext(readFileSync('BP/scripts/features/machines/networkCenter.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,''),env);
    const f=fixture();
    for(let x=1;x<=1200;x++){
        f.put(x,0,'utilitycraft:energy_cable',['dorios:isTube']);
        f.put(x,1,`test:machine_${x}`);f.entries.set(`${x},1,0`,endpoint(`machine_${x}`));
    }
    finish(f.monitor,100);
    const items = new Map(), state = { monitor:f.monitor,rendered:{} }, entity={id:'monitor',isValid:true};
    const container={setItem:(i,v)=>items.set(i,v),getItem:i=>items.get(i)};
    const machine={entity,container};
    env.testState=state;vm.runInContext('states.set("monitor",testState)',env);
    env.render(machine,state);
    assert(state.pages[0].length>1);assert(state.pages[3].length>1);
    for(const pages of Object.values(state.pages)) for(const page of pages) new LoreStack().setLore(page);
    for(const slot of [0,3]){
        const seen=new Set(), first=JSON.stringify(items.get(slot).lore);
        for(let page=0;page<state.pages[slot].length;page++){
            for(const part of loreParts(items.get(slot)))if(part.translate?.startsWith('tile.test:machine_'))seen.add(part.translate);
            items.delete(slot);handlers.get(slot)({entity,container});
            // Same restore order used by ButtonManager: plain filler first, deferred lore next.
            items.set(slot,new LoreStack());while(jobs.length)jobs.shift()();
        }
        assert.equal(seen.size,1200);assert.equal(JSON.stringify(items.get(slot).lore),first);
    }
    const before=items.get(0);
    buttons.activeWatchers.set(entity.id,{});items.delete(0);
    env.system.currentTick++;state.rendered[0]='force refresh';env.render(machine,state);
    assert.equal(items.get(0),undefined,'render must not refill a pending click before ButtonManager sees it');
    buttons.activeWatchers.clear();assert(before);
});
