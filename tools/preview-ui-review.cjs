// Read-only UI preview: vanilla -> UtilityCraft -> AT. Never modifies dependency packs.
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const source = path.join(os.homedir(), 'AppData/Local/DoriosStudios/Bedrock-UI-Preview/source');
const { discover, loadPacks, parseUI } = require(path.join(source, 'lib/loader.cjs'));
const { chromium } = require(path.join(source, 'node_modules/playwright-core'));
const arg = (key, fallback) => process.argv.find(s => s.startsWith('--' + key + '='))?.split('=').slice(1).join('=') || fallback;
(async () => {
  const output = path.resolve(arg('out', 'docs/previews/ui-review/before'));
  await fs.mkdir(output, { recursive: true });
  const { roots } = await discover(path.resolve('RP/ui/chest_screen.json'), { vanillaPack: path.join(source, '../bedrock-samples/resource_pack') });
  const bundle = await loadPacks(roots, arg('locale', 'en_US'));
  // Reuse locally cached vanilla icons; the reduced installed mirror omits items.
  const cached = path.join(os.tmpdir(), 'ascendant-alchemy-ui/vanilla');
  async function addCached(dir) { for(const entry of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])) {
    const file=path.join(dir,entry.name); if(entry.isDirectory()) await addCached(file);
    else if(entry.name.endsWith('.png')) { const key=path.relative(cached,file).replaceAll('\\','/').slice(0,-4);bundle.textures[key]??={file}; }
  }}
  await addCached(cached);
  console.log('Loaded ' + Object.keys(bundle.definitions).length + ' definitions from ' + roots.join(', '));
  const routes = [...new Set([...((await fs.readFile('RP/ui/chest_screen.json', 'utf8')).matchAll(/"\$screen_content":\s*"([^"]+)"/g))].map(m => m[1]))];
  const assets = new Map(); let index = 0;
  for (const entry of Object.values(bundle.textures)) { entry.url = '/asset/' + index++; assets.set(entry.url, entry.file); }
  const server = http.createServer(async (req, res) => {
    try {
      let file = assets.get(req.url);
      if (['/engine.js', '/renderer.js'].includes(req.url)) file = path.join(source, 'media', req.url.slice(1));
      if (!file) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#26313a"><canvas></canvas><script src="/engine.js"></script><script src="/renderer.js"></script>'); return; }
      let body = await fs.readFile(file);
      if (req.url === '/engine.js') body = body.toString().replace('++this.counter>7000', '++this.counter>100000')
        .replaceAll("'checked_locked','unchecked_locked']", "'checked_locked','unchecked_locked','checked_locked_hover','unchecked_locked_hover']")
        .replace('this.layout(child,parentBox,node.z,node.alpha,childClip);', 'this.layout(child,parentBox,node.z,p.propagate_alpha === false ? alpha : node.alpha,childClip);');
      // Image colors multiply the source RGB in Bedrock; source-atop in this
      // preview version erases all shading (notably the tinted cryo cells).
      if(req.url==='/renderer.js') body=body.toString().replace("ctx.globalCompositeOperation='source-atop';ctx.fillStyle=tint;ctx.fillRect(0,0,c.width,c.height);", "ctx.globalCompositeOperation='multiply';ctx.fillStyle=tint;ctx.fillRect(0,0,c.width,c.height);ctx.globalCompositeOperation='destination-in';ctx.drawImage(image,0,0);");
      res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'text/javascript; charset=utf-8'); res.end(body);
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const report = arg('merge','')==='1' ? await fs.readFile(path.join(output,'report.json'),'utf8').then(s=>JSON.parse(s).cases).catch(()=>[]) : [];
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.evaluate(bundle => { window.bundle = bundle; }, bundle);
    console.log('Preview ready');
    for (const root of routes.filter(r => !arg('machine', '') || r.startsWith(arg('machine', '') + '.'))) {
      const machine = root.split('.')[0];
      console.log('Building ' + machine);
      const title = machine.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      let preset = JSON.parse(await fs.readFile('RP/ui/liquifier.preview.json', 'utf8'));
      try { preset = JSON.parse(await fs.readFile('RP/ui/' + machine + '.preview.json', 'utf8')); } catch {}
      preset.variables.$container_title = bundle.strings['entity.utilitycraft:' + machine + '.name'] || title;
      preset.variables.$localize_title = false;
      preset.bindings['#container_title'] = preset.variables.$container_title;
      preset.bindings['#title_text'] = preset.variables.$container_title;
      // Simulated empty slots; retain text and progress from per-machine fixtures only.
      if (!['alchemical_station','liquifier','residue_processor','catalyst_weaver','enchantment_station','mob_chamber'].includes(machine)) {
        preset.collections.container_items = {0:{'#item_id_aux':1,texture:'textures/ui/energy_bar/energy_frame_24'},1:{'#item_id_aux':1,'#hover_text':'§eMachine Information\n§fReady\n\n§ePerformance\n§aSpeed §f1.00\n§aEfficiency §f1.00\n\n§eEnergy\n§bStored §f1.00 MDE\n§bCapacity §f2.00 MDE'}};
      }
      for (const b of ['#gamepad_helper_visible','#is_selected_slot','#touch_progress_bar_visible','#item_lock_in_inventory','#item_lock_in_slot','#item_lock','#bundle_selected_item_visible','#bundle_open_back','#bundle_open_front','#show_persistent_bundle_hover_text','#using_touch','#progress_bar_visible','#item_durability_visible','#item_storage_visible','#selected_item_durability_visible','#selected_item_storage_visible','#inventory_selected_item_lock_in_inventory','#inventory_selected_item_lock_in_slot']) preset.bindings[b] = false;
      preset.bindings['#inventory_selected_item'] = 0;
      preset.controls = {};
      delete preset.adapters;
      const sourceData=Object.values(bundle.definitions).filter(d=>d.namespace===machine).map(d=>d.value);
      function fillLabels(value){if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){
        if(/@(?:uc.text_label|at_core.collection_text)$/.test(k)&&v.collection_index!==undefined) preset.collections.container_items[v.collection_index]??={'#item_id_aux':1,'#hover_text':preset.collections.container_items[1]?.['#hover_text']||'§eMachine Information\n§fReady'};
        fillLabels(v);
      }} sourceData.forEach(fillLabels);
      if(machine==='power_beacon') preset.collections.container_items[1]['#hover_text']='§dPower Beacon\n§7Transmission: §fEnabled\n§7Range: §f128 blocks\n§7Targets: §f12\n§7Receiving: §f8\n§7Rate: §f32 KDE/t\n§7Sent: §f24 KDE/t';
      if(machine==='laser_barrier') preset.collections.container_items[1]['#hover_text']='§aActive\n§7Power: §fEnabled\n§7Field: §f8 x 6\n§7Projected: §f48/48\n§7Damage: §f4\n§7Upkeep: §f480 DE/cycle\n§7Size: §fL3 H3';
      // Network Center has no active label producer in the checked-out BP.
      // Short, explicitly illustrative fixtures avoid overflowing its small status cells
      // with the unrelated generic machine performance paragraph.
      if(machine==='network_center') {
        const labels=['§eConnections\n§fPreview data\n\n§7Machines: §f12\n§7Storage: §f4',
          '§eTransfer\n§fPreview data\n§7Rate: §f32 KDE/t',
          '§eNetwork\n§fPreview data',
          '§eEnergy\n§fPreview data\n\n§7Stored: §f1 MDE\n§7Capacity: §f2 MDE',
          '§eStatus\n§fPreview data'];
        labels.forEach((text,i)=>preset.collections.container_items[i]={'#item_id_aux':1,'#hover_text':text});
      }
      if(machine==='refining_table') preset.collections.container_items[11]={'#item_id_aux':1,'#hover_text':'§eEquipment Statistics\n§fDiamond Sword\n\n§aDamage §f+4\n§aDurability §f+25%\n\n§eEnhancements\n§fSharpness V\nUnbreaking III\nMending I'};
      const defaults = await page.evaluate(({root,preset}) => {
        const e = new BedrockEngine.Engine(bundle,preset), r=e.build(root,480,270), controls={};
        for(const n of r.nodes.filter(n=>n.p.type==='toggle')) controls[n.name] ??= {'#toggle_state':n.p.toggle_default_state??false};
        return controls;
      },{root,preset});
      const modes = [{name:'main',controls:{}}];
      if(machine==='mob_chamber' && arg('states','all')==='all') {
        for(const count of [1,2,3]) modes.push({name:'essences_'+count,controls:{},items:{3:{'#hover_text':`at:mob_chamber:v1|e${count}|p04`}}});
        for(const status of ['empty','energy','loot','xp','fluid','restore','storage','resources','error','completed']) modes.push({name:status,controls:{},items:{2:{'#hover_text':`at:mob_chamber:meters:v1|t${['empty','completed'].includes(status)?0:22}|e${status==='energy'?0:18}|x${status==='xp'?22:8}|s${status}|`}}});
      }
      if (arg('states','all') === 'all') {
        for (const toggle of ['recipes_toggle_button','upgrade_toggle_button','io_toggle_button','info_toggle_button','stats_toggle']) if(toggle in defaults) modes.push({name:toggle.replace('_toggle_button','').replace('_toggle',''),controls:{[toggle]:{'#toggle_state':true}}});
        const groups = {cryo_chamber:['freezing_tab','generation_tab','stabilization_tab'],alchemical_station:['alchemy_brewing_tab','alchemy_aplifying_tab'],enchantment_station:['station_enchant_tab','station_disenchant_tab']};
        const group = groups[machine];
        if(group) for(const toggle of group.slice(1)) modes.push({name:toggle,controls:Object.fromEntries(group.map(t=>[t,{'#toggle_state':t===toggle}]))});
        if(machine==='alchemical_station') for(const t of ['recipes','progression']) modes.push({name:t,controls:Object.fromEntries(['display','recipes','progression'].map(s=>['alchemy_'+s+'_tab',{'#toggle_state':s===t}]))});
      }
      if(arg('deep','')==='1') {
        for(const mode of [...modes].filter(m=>['recipes','progression','info','stats'].includes(m.name))) modes.push({...mode,name:mode.name+'_bottom',bottom:true});
        if('recipes_toggle_button' in defaults) {
          const recipes=await page.evaluate(({root,preset,defaults})=>{
            const e=new BedrockEngine.Engine(bundle,{...preset,controls:{...defaults,recipes_toggle_button:{'#toggle_state':true}}});
            return e.build(root,480,270).nodes.filter(n=>n.p.type==='toggle' && /recipe/.test(n.name) && n.name!=='recipes_toggle_button').map(n=>n.name);
          },{root,preset,defaults});
          for(const [label,toggle] of [['first',recipes[0]],['last',recipes.at(-1)]]) if(toggle)modes.push({name:'recipe_'+label,controls:{...Object.fromEntries(recipes.map(t=>[t,{'#toggle_state':t===toggle}])),recipes_toggle_button:{'#toggle_state':true}},bottom:label==='last'});
        }
      }
      for(const mode of modes) {
        if(arg('mode','') && !arg('mode','').split(',').includes(mode.name)) continue;
        const state=structuredClone(preset); state.controls={...defaults,...mode.controls};state._bottom=mode.bottom;
        if(mode.items) Object.assign(state.collections.container_items,mode.items);
        // This preview engine reads named view sources from state.controls;
        // mirror the real collection bindings on the two zero-size readers.
        if(machine==='mob_chamber') {
          state.controls.state_reader={'#chamber_state':state.collections.container_items[3]['#hover_text']};
          state.controls.meter_reader={'#meter_state':state.collections.container_items[2]['#hover_text']};
          if(mode.name==='empty') for(let i=4;i<=7;i++) state.collections.container_items[i]={'#item_id_aux':0,'#hover_text':''};
          if(mode.name==='loot') for(let i=9;i<=35;i++) state.collections.container_items[i]={'#item_id_aux':1,'#inventory_stack_count':'64',texture:'textures/items/rotten_flesh'};
        }
        const width=Number(arg('width','480')),height=Number(arg('height','270')), scale=2;
        await page.setViewportSize({width:width*scale,height:height*scale});
        const result=await page.evaluate(({root,state,width,height,scale})=>{
          window.engine=new BedrockEngine.Engine(bundle,state);window.result=engine.build(root,width,height);
          for(const n of result.nodes){let a=n;while(a&&a.p.allow_clipping!==false)a=a.parent;if(a)n.clip=null;}
          if(state._bottom)for(const n of engine.nodes.filter(n=>n.scroll&&!n.hidden))engine.scrollTo(n,n.scroll.max);
          window.renderer=new BedrockRenderer.Renderer(document.querySelector('canvas'),bundle,state);renderer.resize(width,height,scale);renderer.draw(result.nodes);
          return {warnings:result.warnings,nodes:result.nodes.filter(n=>!n.hidden).map(n=>({name:n.name,path:n.path,box:n.box,type:n.p.type,text:n.p.text,texture:n.p.texture,color:n.p.color,scale:n.p.font_scale_factor,index:n.index,collection:n.collection,scroll:n.scroll?{max:n.scroll.max,offset:n.scroll.offset}:undefined,clip:n.clip}))};
        },{root,state,width,height,scale});
        await page.waitForFunction(()=>[...renderer.images.values()].every(i=>i.complete));
        await page.evaluate(()=>renderer.draw(result.nodes));
        result.renderWarnings=await page.evaluate(()=>[...renderer.warnings]);
        const name=machine+'--'+mode.name;
        await page.screenshot({path:path.join(output,name+'.png'),timeout:30000});
        await fs.writeFile(path.join(output,name+'.json'),JSON.stringify(result));
        const old=report.findIndex(c=>c.name===name);if(old!==-1)report.splice(old,1);
        report.push({name,nodeCount:result.nodes.length,warnings:result.warnings,renderWarnings:result.renderWarnings});
        console.log(name+' '+result.nodes.length+' nodes');
      }
    }
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify({roots,packWarnings:bundle.warnings,cases:report},null,2));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
