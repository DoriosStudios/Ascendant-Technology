const formatFluidVolume = require('./format-fluid-volume.cjs');
// Build read-only UtilityCraft recipe grids from the active machine definitions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''));
const write=(f,v)=>fs.writeFileSync(path.join(root,f),JSON.stringify(v,null,4)+'\n');
function definitions(file,names){
 const source=fs.readFileSync(path.join(root,'BP/scripts/config/recipes',file),'utf8').replace(/^import[^;]+;\s*/gm,'').replace(/\bexport /g,'');
 return vm.runInNewContext(source+'\n;({'+names.join(',')+'})',{system:{afterEvents:{scriptEventReceive:{subscribe(){}}}},registerSingularityRecipes(){}},{timeout:1000});
}
const energizer=definitions('energizer.js',['energizerRecipeDefinitions']).energizerRecipeDefinitions;
const freezing=definitions('freezing.js',['freezingRecipeDefinitions']).freezingRecipeDefinitions;
const stabilizer=definitions('stabilizer.js',['stabilizerRecipeDefinitions']).stabilizerRecipeDefinitions;
const crucible=definitions('industrialCrucible.js',['industrialCrucibleRecipes']).industrialCrucibleRecipes;
const vapor=definitions('vaporworksProcessor.js',['vaporworksRecipeDefinitions']).vaporworksRecipeDefinitions;
const singularity=definitions('singularityFabricator.js',['singularityFabricatorRecipeDefinitions','rarityEnergyPerSecond']);
const cryogen=definitions('cryogen.js',['cryogenCatalystDefinitions','cryogenGeneration','cryogenSynthesisRecipe']);
const atlases=[read('RP/textures/item_texture.json'),read('../UtilityCraft/RP/textures/item_texture.json'),read('RP/textures/terrain_texture.json'),read('../UtilityCraft/RP/textures/terrain_texture.json')];
const tex=e=>typeof e==='string'?e:Array.isArray(e)?tex(e[0]):tex(e?.textures);
const native={cooked_beef:'items/beef_cooked',beef:'items/beef_raw',cooked_porkchop:'items/porkchop_cooked',porkchop:'items/porkchop_raw',cooked_chicken:'items/chicken_cooked',chicken:'items/chicken_raw',cooked_mutton:'items/mutton_cooked',mutton:'items/mutton_raw',cooked_rabbit:'items/rabbit_cooked',rabbit:'items/rabbit_raw',cooked_cod:'items/fish_cooked',cod:'items/fish_raw',cooked_salmon:'items/fish_salmon_cooked',salmon:'items/fish_salmon_raw',baked_potato:'items/potato_baked',potato:'items/potato',magma:'blocks/magma',basalt:'blocks/basalt_side',iron_ingot:'items/iron_ingot',raw_iron:'items/raw_iron',iron_block:'blocks/iron_block',raw_iron_block:'blocks/raw_iron_block',redstone_block:'blocks/redstone_block',cobblestone:'blocks/cobblestone',stone:'blocks/stone',smooth_stone:'blocks/stone_slab_top',netherrack:'blocks/netherrack',nether_brick:'items/netherbrick',blackstone:'blocks/blackstone',polished_blackstone:'blocks/polished_blackstone',polished_basalt:'blocks/polished_basalt_side',granite:'blocks/stone_granite',polished_granite:'blocks/stone_granite_smooth',diorite:'blocks/stone_diorite',polished_diorite:'blocks/stone_diorite_smooth',andesite:'blocks/stone_andesite',polished_andesite:'blocks/stone_andesite_smooth',magma_cream:'items/magma_cream',lapis_lazuli:'items/dye_powder_blue'};
native.slime_ball='items/slimeball';
Object.assign(native,{ender_pearl:'items/ender_pearl',ancient_debris:'blocks/ancient_debris_side',totem_of_undying:'items/totem',nether_star:'items/nether_star',dragon_egg:'blocks/dragon_egg',shulker_shell:'items/shulker_shell',wither_skeleton_skull:'static/images/wither_skull'});
Object.assign(native,{snow:'blocks/snow',ice:'blocks/ice',packed_ice:'blocks/ice_packed',blue_ice:'blocks/blue_ice',blaze_rod:'items/blaze_rod',breeze_rod:'items/breeze_rod'});
const fluids={water:'textures/entity/water_fluid',cryofluid:'textures/entity/cryofluid',steam:'textures/static/images/steam',saline_coolant:'textures/entity/saline_coolant_fluid',lava:'textures/entity/lava_fluid'};
// Steam has a square native tank texture in UtilityCraft, resolved below.
const fluidName={water:'Water',cryofluid:'Cryofluid',steam:'Steam',saline_coolant:'Saline Coolant',lava:'Lava',dark_matter:'Dark Matter'};
function texture(id){const short=id.split(':').pop();if(id==='utilitycraft:titanium')return 'textures/items/ores/titanium_ingot';if(id.startsWith('fluid:'))return fluids[short];if(id.startsWith('minecraft:')){if(!native[short])throw Error('Missing native mapping: '+id);return 'textures/'+native[short];}for(const a of atlases){const e=a.texture_data['utilitycraft_'+short];if(e)return tex(e);}throw Error('Missing AT/UC icon: '+id);}
const languageFiles=fs.readdirSync(path.join(root,'RP/texts')).filter(f=>f.endsWith('.lang'));
const locales={};for(const f of languageFiles){const strings={};for(const pack of ['../UtilityCraft','']){const p=path.join(root,pack,'RP/texts',f);if(fs.existsSync(p))for(const l of fs.readFileSync(p,'utf8').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)strings[l.slice(0,i)]=l.slice(i+1);}}locales[f]=strings;}
const english=locales['en_US.lang'];
function itemName(id,lang){const short=id.split(':').pop();const strings=locales[lang];for(const k of [`item.${id}.name`,`item.${id}`,`tile.${id}.name`,`tile.${id}`])if(strings[k]||english[k])return (strings[k]||english[k]).split(/\\n|\n/)[0].replace(/§./g,'');return short.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');}
const recipe=(r)=>({input:r.input.id,inputCount:r.input.amount??1,output:r.output.id,outputCount:r.output.amount??1,cost:r.cost??4000,ticks:r.ticks??100,fluid:r.fluid||(r.cryofluid?{type:'cryofluid',amount:r.cryofluid}:null)});
const books={
 singularity_fabricator:singularity.singularityFabricatorRecipeDefinitions.map(r=>({input:r.input,inputCount:1,output:r.input,outputCount:2,cost:singularity.rarityEnergyPerSecond[r.rarity]*r.timeSeconds,ticks:r.timeSeconds*20,fluid:{type:'dark_matter',amount:r.timeSeconds*80}})),
 energizer:Object.values(energizer).map(recipe),
 cryo_freezer:Object.values(freezing).map(recipe),
 cryo_stabilizer:Object.values(stabilizer).map(recipe),
 industrial_crucible:Object.entries(crucible).map(([id,r])=>({input:id,inputCount:r.input.amount,output:r.output.id,outputCount:r.output.amount,cost:r.energyCost,extra:`+${formatFluidVolume(r.lavaGain)} Lava`})),
 vaporworks_processor:Object.values(vapor).map(r=>({input:'fluid:'+r.inputFluid.type,inputCount:r.inputFluid.amount,output:'fluid:'+r.outputGas.type,outputCount:r.outputGas.amount,cost:r.cost,ticks:r.ticks,fluidUnit:true})),
 cryofluid_synthesizer:Object.values(cryogen.cryogenCatalystDefinitions).map(r=>({input:r.input.id,inputCount:r.input.amount,output:'fluid:cryofluid',outputCount:r.cryofluid,cost:cryogen.cryogenGeneration.cost,ticks:cryogen.cryogenGeneration.ticks,extra:`${formatFluidVolume(r.water)} Water + 8 Lapis`})),
};
// Some registries contain optional/future materials absent from the installed
// item atlas. Do not advertise unobtainable entries with a fabricated icon.
for(const [machine,rows] of Object.entries(books)) books[machine]=rows.filter(r=>{
 try {texture(r.input);texture(r.output);return true;}catch(e){console.warn(machine+': omitted '+r.input+' -> '+r.output+' ('+e.message+')');return false;}
});
const ctrl=(k,v)=>({[k]:v}),at=(x,y,w,h)=>({anchor_from:'top_left',anchor_to:'top_left',offset:[x,y],size:[w,h]});
const view=(on=true)=>({binding_type:'view',source_control_name:'recipes_toggle_button',source_property_name:on?'#toggle_state':'(not #toggle_state)',target_property_name:'#visible',resolve_sibling_scope:false});
const label=(text,x,y,w,h,scale=0.6)=>({type:'label',text,localize:true,...at(x,y,w,h),font_scale_factor:scale,color:[0.93,0.93,0.93],shadow:true,layer:3});
// UtilityCraft pattern: a grid of recipe toggles and one selected recipe panel.
// Keep the compact book beside the machine; recipe previews never transfer items.
const ui={namespace:'at_machine_recipes',book:{type:'panel',size:[104,166],layer:6,bindings:[view()],controls:[
 ctrl('background',{type:'image',texture:'textures/ui/background/background_panel',size:[104,166]}),
 ctrl('title_background',{type:'image',texture:'textures/ui/background/dark_top_tab',...at(0,0,104,22),layer:1}),
 ctrl('title',{...label('ui.utilitycraft:recipes_panel.name',8,6,88,12,.85),text_alignment:'center',color:[.9,.9,.9],shadow:false}),
 ctrl('grid_background',{type:'image',texture:'textures/ui/recipe_grid_bg',...at(6,26,92,86),layer:1}),
 ctrl('scroll@at_common.scroll_panel',{...at(8,28,92,82),$content_ref:'$recipe_rows',$scroll_view_port_size:[84,'100%'],$scroll_view_port_max_size:[84,'100%'],$scroll_view_port_size_touch:[84,'100%'],$scroll_view_port_max_size_touch:[84,'100%'],layer:2}),
 ctrl('selection@$recipe_selection',{...at(8,116,88,44),layer:3})
]}};
const translations=Object.fromEntries(languageFiles.map(f=>[f,{}]));
function slot(id,count,offset,key){return {$slot_offset:offset,bindings:[],$slot_item_texture:texture(id),$has_slot_count:!id.startsWith('fluid:'),$slot_count_text:String(count),$has_slot_hover:true,$slot_hover_text:key};}
const compact=n=>n>=1e9?(n/1e9).toFixed(1).replace(/\.0$/,'')+' G':n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,'')+' M':n>=1e3?(n/1e3).toFixed(1).replace(/\.0$/,'')+' K':String(n)+' ';
for(const [machine,rows]of Object.entries(books)){
 const grid=[],panels=[];
 for(let start=0;start<rows.length;start+=4){
  const controls=[];
  for(let column=0;column<4&&start+column<rows.length;column++){
   const i=start+column,r=rows[i],key=`ui.ascendant:recipe_book.${machine}.${i}`,toggle=`${machine}_recipe_${i}`;
   for(const lang of languageFiles){translations[lang][key+'.input']=itemName(r.input,lang);translations[lang][key+'.output']=itemName(r.output,lang);}
   controls.push(ctrl(toggle+'_button@uc.recipe_toggle',{...at(6+column*18,0,18,18),$toggle_name:machine+'_recipes',$toggle_index:7000+i,$toggle_control_name:toggle,$toggle_default_state:i===0,$toggle_hover_text:key+'.input',$toggle_hover_text_localize:true,$recipe_icon:texture(r.input),$toggle_icon_uv_size:r.input==='minecraft:wither_skeleton_skull'?[64,64]:[16,16],$toggle_unchecked_hover:'textures/ui/recipe_book_item_bg',$toggle_checked_hover:'textures/ui/recipe_book_touch_cell_selected'}));
   const details=[`${compact(r.cost)}DE${r.ticks?' / '+r.ticks/20+' s':''}`,r.fluid?`${formatFluidVolume(r.fluid.amount)} ${fluidName[r.fluid.type]}`:r.extra||''].filter(Boolean).join('\n');
   panels.push(ctrl('recipe_'+i+'@uc.recipe_panel',{size:[88,44],$recipe_control_name:toggle,controls:[
    ctrl('input@uc.recipe_slot_overlay',slot(r.input,r.inputCount,[-27,-12],key+'.input')),
    ctrl('arrow',{type:'image',texture:'textures/ui/progress_bar/arrow_right_22',size:[14,10],offset:[0,-12],layer:7}),
    ctrl('output@uc.recipe_slot_overlay',slot(r.output,r.outputCount,[27,-12],key+'.output')),
    ...(r.input.startsWith('fluid:')?[ctrl('input_amount',{...label(formatFluidVolume(r.inputCount),0,18,34,8,.55),color:[.3,.3,.3],shadow:false,text_alignment:'center'})]:[]),
    ...(r.output.startsWith('fluid:')?[ctrl('output_amount',{...label(formatFluidVolume(r.outputCount),54,18,34,8,.55),color:[.3,.3,.3],shadow:false,text_alignment:'center'})]:[]),
    ctrl('details',{...label(details,0,r.output.startsWith('fluid:')?28:20,88,r.output.startsWith('fluid:')?16:24,.55),color:[.3,.3,.3],shadow:false,text_alignment:'center'})
   ]}));
  }
  grid.push(ctrl('row_'+start,{type:'panel',size:[84,18],controls}));
 }
 ui[machine+'_rows']={type:'stack_panel',orientation:'vertical',size:[84,'default'],controls:grid};
 ui[machine+'_selection']={type:'panel',size:[88,44],controls:panels};
}
write('RP/ui/recipes/machine_books.json',ui);
for(const [lang,entries]of Object.entries(translations)){const f=path.join(root,'RP/texts',lang);let text=fs.readFileSync(f,'utf8').replace(/^ui\.ascendant:recipe_book\.[^\r\n]*\r?\n/gm,'').trimEnd();fs.writeFileSync(f,text+'\n'+Object.entries(entries).map(([k,v])=>k+'='+v).join('\n')+'\n');}
console.log(Object.fromEntries(Object.entries(books).map(([k,v])=>[k,v.length])));
