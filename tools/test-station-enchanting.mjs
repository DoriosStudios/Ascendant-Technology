import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const catalog = [
 ['sharpness',5],['efficiency',5],['unbreaking',3],['fortune',3],
 ['silk_touch',1],['mending',1],['fire_aspect',2],['protection',4],
 ['extra_enchantment',7],['binding',1],
].map(([id,maxLevel])=>({id:'minecraft:'+id,maxLevel}));
class Stack {
 constructor(id='test:tool'){this.typeId=id;this.enchants=[];this.props=new Map();}
 clone(){const s=new Stack(this.typeId);s.enchants=this.enchants.map(e=>({...e}));s.props=new Map(this.props);return s;}
 getDynamicProperty(k){return this.props.get(k);}
 setDynamicProperty(k,v){this.props.set(k,v);}
 getComponent(){const s=this;return {
 getEnchantments:()=>s.enchants,
 removeAllEnchantments:()=>{s.enchants=[];},
 canAddEnchantment:({type})=>!s.enchants.some(e=>e.type.id===type.id || ([e.type.id,type.id].includes('minecraft:silk_touch')&&[e.type.id,type.id].includes('minecraft:fortune'))),
 addEnchantment(e){assert(this.canAddEnchantment(e));s.enchants.push(e);},
 addEnchantments(es){for(const e of es)this.addEnchantment(e);},
 };}
}
const source=readFileSync(new URL('../BP/scripts/ATCore/enchanting/stationEnchanting.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
const context=vm.createContext({EnchantmentTypes:{getAll:()=>catalog,get:id=>catalog.find(t=>t.id===id)},Math});
vm.runInContext(source,context);
for(let round=0;round<30;round++){
 let item=new Stack();
 for(let tier=1;tier<=5;tier++){
  const {plan}=context.buildStationEnchantPlan(item,{enchantability:tier,curseProtection:1});
  assert.equal(plan.enchantments.length,tier<5?tier:8);
  assert(!plan.enchantments.some(e=>e.id==='minecraft:binding'));
  const updated=context.applyStationEnchantPlan(item,plan);assert(updated);
  for(const old of item.enchants)assert(updated.enchants.find(e=>e.type.id===old.type.id).level>=old.level);
  if(tier===5){
   for(const e of plan.enchantments)assert.equal(e.level,catalog.find(t=>t.id===e.id).maxLevel);
   assert.equal(context.buildStationEnchantPlan(updated,{enchantability:tier,curseProtection:1}).plan.changed,false);
  }
  item=updated;
 }
}
const aiot=context.buildStationEnchantPlan(new Stack('utilitycraft:aetherium_aiot'),{enchantability:5,curseProtection:1}).plan;
assert(aiot.enchantments.some(e=>e.id==='minecraft:extra_enchantment'&&e.level===7));
const stale=new Stack();stale.props.set('utilitycraft:ascane_enchant_plan',JSON.stringify({moduleLevel:2,ids:['minecraft:mending','missing:enchantment'],curseRoll:1}));
assert.equal(context.buildStationEnchantPlan(stale,{enchantability:2,curseProtection:1}).plan.enchantments.length,2);
console.log('PASS: 30 tier progressions, max levels, conflicting targets, stale plans, AIOT catalog and convergence.');
