// Registered pack UI and actual presentation logic, with simulated network data.
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const preview = path.join(os.homedir(), 'AppData/Local/DoriosStudios/Bedrock-UI-Preview/source');
const { discover, loadPacks } = require(path.join(preview, 'lib/loader.cjs'));
const { chromium } = require(path.join(preview, 'node_modules/playwright-core'));
const tabs = ['overview', 'gains', 'losses', 'capacity'];
const tabFilter = process.argv.find(arg => arg.startsWith('--tab='))?.slice(6);
const sizeFilter = process.argv.find(arg => arg.startsWith('--size='))?.slice(7);
(async () => {
    const out = path.resolve('.tmp/network-center-preview'); await fs.mkdir(out, { recursive: true });
    const vanilla = process.argv.find(arg => arg.startsWith('--vanilla='))?.slice(10) ?? path.resolve('../Vanilla/resource_pack');
    const { roots } = await discover(path.resolve('RP/ui/network_center.json'), { vanillaPack: vanilla });
    const bundle = await loadPacks(roots, 'pt_BR');
    const { NetworkMonitor, monitorMessage, monitorLorePages } = await import(pathToFileURL(path.resolve('BP/scripts/ATCore/networks/networkMonitor.js')));
    const blocks = new Map(), entries = new Map(), key = p => `${p.x},${p.y},${p.z}`;
    const put = (x, y, id, cable = false) => {
        const b = { typeId: id, location: { x, y, z: 0 }, hasTag: t => t === 'dorios:energy' || cable && t === 'dorios:isTube', permutation: { getState: () => true } };
        blocks.set(key(b.location), b); return b;
    };
    put(0, 0, 'utilitycraft:network_center');
    for (let x = 1; x <= 98; x++) {
        put(x, 0, 'utilitycraft:energy_cable', true);
        const kind = x <= 80 ? 'machines' : x <= 88 ? 'generators' : x <= 96 ? 'batteries' : 'relays';
        const type = `preview:${kind}_${x}`; put(x, 1, type);
        bundle.strings[`tile.${type}.name`] = `${{machines:'Máquina',generators:'Gerador',batteries:'Bateria',relays:'Emissor'}[kind]} ${x}`;
        entries.set(`${x},1,0`, { id: type, type, kind, consumer: kind === 'machines', active: x % 3 !== 0,
            stored: 10000, capacity: kind === 'batteries' ? 2000000 : 100000,
            generation: kind === 'generators' ? 4000 : 0, transfer: kind === 'batteries' ? 8000 : 0, distribution: kind === 'relays' ? 1000 : 0 });
    }
    const monitor = new NetworkMonitor({x:0,y:0,z:0},{block:p=>blocks.get(key(p))??{hasTag:()=>false},read:b=>entries.get(key(b.location))});
    while (!monitor.step(100,64)) {}
    for (const entry of entries.values()) entry.stored += 200;
    while (!monitor.step(200,64)) {}
    const panels = new Map();
    const context = vm.createContext({ NetworkMonitor, monitorMessage, monitorLorePages, ButtonManager: { activeWatchers:new Map(),registerMachineButton(){} }, system:{currentTick:220}, world:{afterEvents:{entityRemove:{subscribe(){}}}},
        ItemStack:class{setLore(lore){assert(lore.length<=100);for(const line of lore)assert(Buffer.byteLength(JSON.stringify(line),"utf8")<=1000);this.lore=lore;}}, registerATMachine(){},
        EnergyStorage:{formatEnergyToText:value=>value>=1e6?`${(value/1e6).toFixed(2)} MDE`:value>=1000?`${(value/1000).toFixed(1)} kDE`:`${value} DE`} });
    vm.runInContext((await fs.readFile('BP/scripts/features/machines/networkCenter.js','utf8')).replace(/^import[\s\S]*?;\r?\n/gm,''),context);
    context.render({container:{setItem:(i,item)=>panels.set(i,item)}},{monitor,rendered:{}});
    const text = raw => raw.rawtext.map(part => part.text ?? (bundle.strings[part.translate] ?? part.translate)).join('');
    const collections = Object.fromEntries([...panels].map(([i,item])=>[i,{'#hover_text':item.lore.map(text).join('\n'),'#item_name':' ','#item_visible':true}]));
    const assets = new Map(); let index = 0;
    for (const texture of Object.values(bundle.textures)) { texture.url = '/asset/' + index++; assets.set(texture.url, texture.file); }
    const server = http.createServer(async (req, res) => {
        try {
            const file = assets.get(req.url) ?? (['/engine.js','/renderer.js'].includes(req.url)?path.join(preview,'media',req.url.slice(1)):undefined);
            if (file) {res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'text/javascript');res.end(await fs.readFile(file));}
            else res.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#26313a"><canvas></canvas><script src="/engine.js"></script><script src="/renderer.js"></script>');
        } catch(e){res.writeHead(500);res.end(String(e));}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    try {
        browser=await chromium.launch({channel:'msedge',headless:true});
        const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
        for (const [width,height] of [[480,270],[360,240]].filter(size => !sizeFilter || size.join('x') === sizeFilter)) for(const tab of tabs.filter(t => !tabFilter || t === tabFilter)) for(const bottom of [false,true]) {
            const state={adapters:{font:{fixedAdvance:6,advance:6,lineHeight:10}},variables:{'$desktop_screen':true,'$touch':false},
                bindings:{'#visible':true,'#enabled':true,'#mouse_mode':true,'#hover_text':''},
                controls:Object.fromEntries(tabs.map(t=>[t+'_tab',{'#toggle_state':t===tab}])),collections:{container_items:collections}};
            await page.setViewportSize({width:width*3,height:height*3});
            const report=await page.evaluate(({bundle,state,width,height,tab,bottom})=>{
                const engine=new BedrockEngine.Engine(bundle,state);
                // Use pixel-rounded font extents; fractional fixed-advance sums otherwise wrap natural-width labels.
                engine.measure=(text,scale)=>Math.ceil(text.length*6*scale);
                const result=engine.build('network_center.utility_panel',width,height);
                if(bottom)for(const node of engine.nodes.filter(n=>n.scroll&&n.path.includes('/'+tab+'_page/')))engine.scrollTo(node,node.scroll.max);
                // The preview engine omits locked-hover variants from its toggle-state filter.
                // These fixture buttons are neither locked nor hovered; match the native inactive state.
                for(const node of result.nodes)if(/\/(?:un)?checked_locked_hover(?:\/|$)/.test(node.path))node.hidden=true;
                window.previewRenderer=new BedrockRenderer.Renderer(document.querySelector('canvas'),bundle,state);
                previewRenderer.resize(width,height,3);window.previewNodes=result.nodes;previewRenderer.draw(result.nodes);
                return {warnings:result.warnings,pages:result.nodes.filter(n=>/^(overview|gains|losses|capacity)_page$/.test(n.name)).map(n=>({name:n.name,hidden:n.hidden,box:n.box})),
                    footerRow:result.nodes.find(n=>n.name==='status').box,headers:result.nodes.filter(n=>n.name==='header'&&!n.hidden).map(n=>n.box),nextButtons:result.nodes.filter(n=>n.name==='next_page'&&!n.hidden).map(n=>n.box),dashboard:result.nodes.find(n=>n.name==='dashboard').box,card:result.nodes.find(n=>n.name==='view_top_bar').box,
                    icons:result.nodes.filter(n=>n.p.type==='image'&&n.name==='icon'&&!n.hidden&&/_tab\//.test(n.path)).map(n=>({path:n.path,texture:n.p.texture,box:n.box})),
                    tabs:result.nodes.filter(n=>n.p.type==='toggle'&&n.name.endsWith('_tab')).map(n=>({name:n.name,box:n.box})),
                    labels:result.nodes.filter(n=>n.p.type==='label'&&!n.hidden).map(n=>({name:n.name,path:n.path,box:n.box,content:n.content,text:String(n.p.text).slice(0,100),clip:n.clip})),
                    scrolls:result.nodes.filter(n=>n.scroll&&!n.hidden).map(n=>({name:n.name,box:n.box,max:n.scroll.max}))};
            },{bundle,state,width,height,tab,bottom});
            assert.deepEqual(report.pages.filter(p=>!p.hidden).map(p=>p.name),[tab+'_page']);
            assert.equal(report.tabs.length,4);
            assert.equal(report.headers.length,1);assert.equal(report.nextButtons.length,1);
            assert(report.headers[0].y < report.pages.find(p=>!p.hidden).box.y,'header belongs on title row');
            assert(report.nextButtons[0].w > 20 && report.nextButtons[0].w < 100,'page button follows text width: '+JSON.stringify({headers:report.headers,next:report.nextButtons}));
            const title = report.labels.find(n=>n.name==='page_title');
            assert(title.content[1] <= 12,'category title must stay on one line');
            const centerY=b=>b.y+b.h/2;
            const mainTitle=report.labels.find(n=>n.name==='title');
            const caption=report.labels.find(n=>n.path.includes('/next_page/')&&n.text.startsWith('Próxima'));
            assert.equal(centerY(title.box),centerY(report.headers[0]),'category vertically centered');
            assert.equal(centerY(mainTitle.box),centerY(report.headers[0]),'main title vertically centered');
            assert(caption);assert.equal(centerY(caption.box),centerY(report.headers[0]),'button caption vertically centered');
            assert(title.box.x >= report.dashboard.x + 110,'navigation must stay beside the main title');
            assert(title.box.x + title.box.w <= report.nextButtons[0].x + 1,'category title must not overlap page button');
            assert(report.nextButtons[0].x + report.nextButtons[0].w <= report.dashboard.x + report.dashboard.w,'page button remains inside header');
            assert(report.dashboard.h<=166);assert.equal(report.dashboard.w,250);assert.equal(report.card.h,27);
            assert.equal(report.card.y + report.card.h, report.dashboard.y + 4);
            const data = report.labels.find(n=>n.name==='label_v1'&&n.path.includes('/'+tab+'_page/'));
            if(!bottom)assert.equal(data.box.y, report.scrolls[0].box.y, 'no blank spacer above lore');
            const footer = report.labels.find(n=>n.name==='label_v1'&&n.path.includes('/status/'));
            assert(footer.box.y + footer.box.h <= report.dashboard.y + report.dashboard.h, 'footer stays within panel');
            assert.equal(centerY(footer.box),centerY(report.footerRow),'footer vertically centered');
            for(const name of tabs)assert.equal(report.icons.filter(n=>n.path.includes('/'+name+'_tab/')).length,1,name+' icon state');
            for(const button of report.tabs)assert(button.box.x>=0&&button.box.x+button.box.w<=width+1,button.name);
            await page.waitForFunction(()=>[...previewRenderer.images.values()].every(i=>i.complete));
            await page.evaluate(()=>previewRenderer.draw(previewNodes));
            const name=`${width}x${height}-${tab}${bottom?'-bottom':''}`;
            await page.screenshot({path:path.join(out,name+'.png')});
            await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(report,null,2));
        }
        console.log(`PASS: exclusive tab and scroll-state previews (${tabFilter ?? "all tabs"}, ${sizeFilter ?? "both viewport sizes"}): ${out}`);
    } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
