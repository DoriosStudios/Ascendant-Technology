import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('BP/scripts/config/recipes/residueProcessor.js',root),'utf8');
const recipes=vm.runInNewContext(source.replace('export const','const')+'\nresidueProcessorRecipes');
const textures={
 'utilitycraft:void_essence':'textures/items/misc/void_essence','utilitycraft:aetherium_shard':'textures/items/ores/aetherium_shards',
 'utilitycraft:ender_pearl_dust':'textures/items/dusts/ender_pearl_dust','utilitycraft:calcite_pebble':'textures/items/pebbles/calcite_pebble',
 'minecraft:podzol':'textures/blocks/dirt_podzol_top','minecraft:bone_block':'textures/blocks/bone_block_side',
 'minecraft:bone_meal':'textures/items/dye_powder_white','minecraft:string':'textures/items/string','minecraft:web':'textures/blocks/web',
 'minecraft:hardened_clay':'textures/blocks/hardened_clay','minecraft:clay_ball':'textures/items/clay_ball',
 'minecraft:dirt_with_roots':'textures/blocks/dirt_with_roots','minecraft:dirt':'textures/blocks/dirt',
 'minecraft:hanging_roots':'textures/blocks/hanging_roots','minecraft:muddy_mangrove_roots':'textures/blocks/muddy_mangrove_roots_side',
 'minecraft:mangrove_roots':'textures/blocks/mangrove_roots_side','minecraft:mud':'textures/blocks/mud',
 'minecraft:sand':'textures/blocks/sand','minecraft:gravel':'textures/blocks/gravel','minecraft:sponge':'textures/blocks/sponge',
};
for(const coral of ['tube','brain','bubble','fire','horn'])textures[`minecraft:dead_${coral}_coral_block`]=`textures/blocks/coral_${{tube:'blue',brain:'pink',bubble:'purple',fire:'red',horn:'yellow'}[coral]}_dead`;
const texture=id=>textures[id]??'textures/items/'+id.split(':')[1];
const name=id=>id.startsWith('utilitycraft:')?'item.'+id:((textures[id]??'').includes('/blocks/')?'tile.':'item.')+id.split(':')[1]+'.name';
const bind=[{binding_type:'view',source_control_name:'recipes_toggle_button',source_property_name:'#toggle_state',target_property_name:'#visible',resolve_sibling_scope:false}];
const rows=[],panels=[],slots=[8,9,16,17],positions=[[44,-12],[64,-12],[44,16],[64,16]];
const entries=Object.entries(recipes);
for(let i=0;i<entries.length;i+=4){const controls=[];for(let j=i;j<Math.min(i+4,entries.length);j++){
 const [id,recipe]=entries[j],control='residue_recipe_'+j;
 controls.push({[control+'@uc.recipe_toggle']:{size:[18,18],anchor_from:'top_left',anchor_to:'top_left',offset:[4+(j-i)*18,0],$toggle_name:'residue_recipes',$toggle_index:7000+j,$toggle_control_name:control,$toggle_hover_text:name(id),$recipe_icon:texture(id),$toggle_layer:2}});
 const overlay=(id,amount,slot,offset)=>({collection_index:slot,bindings:[],$slot_offset:offset,$slot_item_texture:texture(id),$slot_hover_text:name(id),$has_slot_hover:true,$slot_count_text:String(amount),$has_slot_count:amount>1});
 const details=[{'input@uc.recipe_slot_overlay':overlay(id,recipe.required,3,[-18,1])}];
 recipe.outputs.forEach((output,k)=>{
  details.push({['output_'+k+'@uc.recipe_slot_overlay']:overlay(output.item,output.amount,slots[k],positions[k])});
  if(output.chance<1)details.push({['chance_'+k]:{type:'label',text:`${Math.round(output.chance*100)}%`,size:[20,8],offset:[positions[k][0],positions[k][1]+13],font_scale_factor:0.5,color:[0.3,0.3,0.3],text_alignment:'center',layer:9}});
 });
 panels.push({[control+'_panel@uc.recipe_panel']:{$recipe_control_name:control,size:[162,72],controls:details}});
}rows.push({['row_'+i]:{type:'panel',size:[88,18],controls}});}
const d={namespace:'residue_processor',recipe_book:{type:'panel',size:[104,166],anchor_from:'top_left',anchor_to:'top_left',offset:[-100,-7],layer:6,bindings:bind,controls:[
 {background:{type:'image',texture:'textures/ui/background/background_panel',size:[104,166]}},
 {title_bg:{type:'image',texture:'textures/ui/background/dark_top_tab',size:[104,22],anchor_from:'top_left',anchor_to:'top_left',layer:1}},
 {title:{type:'label',text:'ui.utilitycraft:recipes_panel.name',size:[88,14],offset:[0,-72],font_scale_factor:0.85,color:[0.9,0.9,0.9],layer:2}},
 {grid_bg:{type:'image',texture:'textures/ui/recipe_grid_bg',size:[92,138],offset:[0,10],layer:1}},
 {'scroll@ascendant_common.info_scroll_view':{size:[104,134],anchor_from:'top_left',anchor_to:'top_left',offset:[8,26],$info_content:'residue_processor.recipe_rows',$scroll_view_port_size:[88,'100%'],$scroll_view_port_max_size:[88,'100%'],$scroll_view_port_size_touch:[88,'100%'],$scroll_view_port_max_size_touch:[88,'100%'],layer:6}},
]},recipe_rows:{type:'stack_panel',orientation:'vertical',size:[88,'default'],controls:rows},recipe_overlays:{type:'panel',size:[162,72],bindings:bind,layer:20,controls:panels}};
await writeFile(new URL('RP/ui/recipes/residue_processor.json',root),JSON.stringify(d,null,4)+'\n');
console.log(`Generated ${entries.length} Residue Processor recipes, up to four outputs.`);
