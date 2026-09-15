import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const recipes=vm.runInNewContext(read('BP/scripts/config/recipes/residueProcessor.js').replace('export const','const')+'\nresidueProcessorRecipes');
let current,registered,io,advanced=0,migration;
class ItemStack{constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;this.maxAmount=64;}clone(){return new ItemStack(this.typeId,this.amount);}}
const context={ItemStack,residueProcessorRecipes:recipes,resourceCost:(_,n)=>n,Machine:class{constructor(){return current;}},registerATMachine:(_,x)=>registered=x,registerIOInterface:(_,x)=>io=x,ensureMachineInventoryLayout:(m,size,slots)=>{migration={size,slots};return m.container.size===size;},advanceProcess:(_,o)=>{advanced++;return {processCount:o.maxCrafts,progress:0,energyUsed:1};},displayProgress(){},renderStatus:(_,a,msg)=>{current.status=msg;},setDynamicNumber(){},setDynamicString(){},setUiItem(){},DoriosLib:{text:{formatIdentifier:x=>x}},Math:Object.assign(Object.create(Math),{random:()=>0})};
vm.createContext(context);vm.runInContext(read('BP/scripts/features/machines/residueProcessor.js').replace(/^import[\s\S]*?;\s*/gm,''),context);
function machine(id,count=4,size=18,version='four_outputs_v2'){
 const items=new Map([[3,new ItemStack(id,count)]]);
 current={valid:true,shouldUpdateUI:true,container:{size,getItem:i=>items.get(i)?.clone(),setItem:(i,v)=>v?items.set(i,v.clone()):items.delete(i)},entity:{getDynamicProperty:()=>version},getProgress:()=>0,processIO(){}};return items;
}
const tick=()=>registered.onTick({}, {params:{machine:{energy_cost:1600}}});
let items=machine('minecraft:hardened_clay');tick();assert(!items.has(3));assert.equal(items.get(8).amount,8);assert.equal(items.get(9).typeId,'minecraft:brick');assert.equal(items.get(16).typeId,'minecraft:miner_pottery_sherd');assert.equal(items.get(17).typeId,'minecraft:explorer_pottery_sherd');
items=machine('minecraft:hardened_clay');items.set(17,new ItemStack('minecraft:explorer_pottery_sherd',64));let before=advanced;tick();assert.equal(advanced,before);assert.equal(items.get(3).amount,4);assert.match(current.status,/Output 4 Full/);
items=machine('minecraft:dead_tube_coral_block',8);tick();assert.equal(items.get(8).typeId,'utilitycraft:calcite_pebble');assert.equal(items.get(16).amount,2);
items=machine('minecraft:string',18);tick();assert.equal(items.get(8).amount,2);
context.Math.random=()=>0.99;items=machine('minecraft:hardened_clay');tick();assert(!items.has(16));assert(!items.has(17));assert.equal(items.get(8).amount,8);
machine('minecraft:string',9,16,'contiguous_upgrades_v1');tick();assert.deepEqual(Array.from(migration.slots),[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,-1,-1]);
machine('minecraft:string',9,16,'');tick();assert.equal(migration.slots[7],15);assert.equal(migration.slots[8],7);
assert.deepEqual(Array.from(io.items.anyOutputSlots),[8,9,16,17]);assert.deepEqual(Array.from(io.items.modes.find(m=>m.id==='output_3').outputSlots),[8,9,16,17]);
console.log('PASS: four output writes, full fourth slot, batching, independent chance failures, legacy migrations and all-output I/O.');
