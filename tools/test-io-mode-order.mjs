import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({registerCoreIOInterface:(id,config)=>({id,config})});
vm.runInContext(readFileSync(new URL('../BP/scripts/ATCore/machinery/ioRegistration.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,''),context);
const modes=[{id:'disabled'},{id:'input_1',inputSlots:[3]},...Array.from({length:6},(_,i)=>({id:`input_${i+2}`,inputSlots:[i+4]})),{id:'input_8',inputSlots:[4,5,6,7,8,9]},{id:'output_1',outputSlots:[16]},{id:'output_2',outputSlots:[15]},{id:'output_3',outputSlots:[16,15]}];
const original=JSON.stringify(modes);
const result=context.registerIOInterface('test',{automaticDefaults:false,items:{buttonSlots:[20,21],modes},liquids:{modes:[{id:'input_1',inputIndices:[0]},{id:'both',inputIndices:[0],outputIndices:[0]}]}}).config;
assert.deepEqual(Array.from(result.items.modes.slice(0,3),m=>m.id),['input_1','input_8','output_3']);
assert.equal(result.items.modes.at(-1).id,'disabled');
assert.equal(result.liquids.modes[0].id,'both');
assert.equal(JSON.stringify(modes),original);
assert.equal(result.automaticDefaults,false);
for(const mode of modes)assert.equal(result.items.modes.find(m=>m.id===mode.id),mode);
console.log('PASS: grouped options first; IDs, slot mappings, input order and configuration preserved.');

const grid=context.prioritizeIOModes({items:{modes:[{id:'input_1',inputSlots:[3,4,5]},{id:'input_2',inputSlots:[6]},{id:'input_3',inputSlots:[6,7]},{id:'output_1',outputSlots:[8,9]},{id:'output_2',outputSlots:[8,9,10]}]}});
assert.deepEqual(Array.from(grid.items.modes,m=>m.id),['input_1','input_3','output_2','output_1','input_2']);
