import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('BP/scripts/config/recipes/residueProcessor.js',root),'utf8');
const recipes=vm.runInNewContext(source.replace('export const','const')+'\nresidueProcessorRecipes');
const textures={
 'utilitycraft:void_essence':'textures/items/misc/void_essence','utilitycraft:aetherium_shard':'textures/items/ores/aetherium_shards',
 'utilitycraft:ender_pearl_dust':'textures/items/dusts/ender_pearl_dust','utilitycraft:calcite_pebble':'textures/items/pebbles/calcite_pebble',
 'utilitycraft:charcoal_dust':'textures/items/dusts/charcoal_dust',
 'minecraft:podzol':'textures/blocks/dirt_podzol_top','minecraft:bone_block':'textures/blocks/bone_block_side',
 'minecraft:bone_meal':'textures/items/dye_powder_white','minecraft:string':'textures/items/string','minecraft:web':'textures/blocks/web',
 'minecraft:seagrass':'textures/blocks/seagrass','minecraft:bamboo':'textures/items/bamboo',
 'minecraft:gunpowder':'textures/items/gunpowder','minecraft:sulfur_spike':'textures/blocks/sulfur_spike_up_tip',
 'minecraft:arrow':'textures/items/arrow','minecraft:flint':'textures/items/flint','minecraft:stick':'textures/items/stick','minecraft:feather':'textures/items/feather',
 'minecraft:hardened_clay':'textures/blocks/hardened_clay','minecraft:clay_ball':'textures/items/clay_ball',
 'minecraft:dirt_with_roots':'textures/blocks/dirt_with_roots','minecraft:dirt':'textures/blocks/dirt',
 'minecraft:hanging_roots':'textures/blocks/hanging_roots','minecraft:muddy_mangrove_roots':'textures/blocks/muddy_mangrove_roots_side',
 'minecraft:mangrove_roots':'textures/blocks/mangrove_roots_side','minecraft:mud':'textures/blocks/mud',
 'minecraft:sand':'textures/blocks/sand','minecraft:gravel':'textures/blocks/gravel','minecraft:sponge':'textures/blocks/sponge',
};
for(const coral of ['tube','brain','bubble','fire','horn'])textures[`minecraft:dead_${coral}_coral_block`]=`textures/blocks/coral_${{tube:'blue',brain:'pink',bubble:'purple',fire:'red',horn:'yellow'}[coral]}_dead`;
const texture=id=>textures[id]??'textures/items/'+id.split(':')[1];
const name=id=>id.startsWith('utilitycraft:')?'item.'+id:((textures[id]??'').includes('/blocks/')?'tile.':'item.')+id.split(':')[1]+'.name';
const rows=[],panels=[];
const entries=Object.entries(recipes);
for(let i=0;i<entries.length;i+=4){const controls=[];for(let j=i;j<Math.min(i+4,entries.length);j++){
 const [id,recipe]=entries[j],control='residue_recipe_'+j;
 controls.push({[control+'_button@uc.recipe_toggle']:{size:[18,18],anchor_from:'top_left',anchor_to:'top_left',offset:[6+(j-i)*18,0],$toggle_name:'residue_recipes',$toggle_index:7000+j,$toggle_control_name:control,$toggle_default_state:j===0,$toggle_hover_text:name(id),$toggle_hover_text_localize:true,$recipe_icon:texture(id),$toggle_layer:2}});
 const overlay=(id,amount,offset)=>({bindings:[],$slot_offset:offset,$slot_item_texture:texture(id),$slot_hover_text:name(id),$has_slot_hover:true,$slot_count_text:String(amount),$has_slot_count:amount>1});
 const details=[{'input@uc.recipe_slot_overlay':overlay(id,recipe.required,[-27,-18])},{arrow:{type:'image',texture:'textures/ui/steam_recipe_arrow',size:[14,10],offset:[0,-18],layer:7}},{cost:{type:'label',text:String(recipe.cost)+' DE',size:[32,8],offset:[27,-18],font_scale_factor:0.5,color:[0.3,0.3,0.3],text_alignment:'center',layer:9}}];
 recipe.outputs.forEach((output,k)=>{const x=-27+k*18;
  details.push({['output_'+k+'@uc.recipe_slot_overlay']:overlay(output.item,output.amount,[x,0])});
  details.push({['chance_'+k]:{type:'label',text:String(Math.round(output.chance*100))+'%',size:[18,8],offset:[x,15],font_scale_factor:0.5,color:[0.3,0.3,0.3],text_alignment:'center',layer:9}});
 });
 panels.push({[control+'_panel@uc.recipe_panel']:{$recipe_control_name:control,size:[88,44],controls:details}});
}rows.push({['row_'+i]:{type:'panel',size:[84,18],controls}});}
const d={namespace:'residue_processor','recipe_book@at_machine_recipes.book':{anchor_from:'top_left',anchor_to:'top_left',offset:[-101,-7],$recipe_rows:'residue_processor.recipe_rows',$recipe_selection:'residue_processor.recipe_selection'},recipe_rows:{type:'stack_panel',orientation:'vertical',size:[84,'default'],controls:rows},recipe_selection:{type:'panel',size:[88,44],controls:panels}};
await writeFile(new URL('RP/ui/recipes/residue_processor.json',root),JSON.stringify(d,null,4)+'\n');
console.log('Generated '+entries.length+' Residue Processor recipes in the shared book.');
