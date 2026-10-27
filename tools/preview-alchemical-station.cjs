const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const preview = path.join(os.homedir(), 'AppData/Local/DoriosStudios/Bedrock-UI-Preview/source');
const { discover, loadPacks } = require(path.join(preview, 'lib/loader.cjs'));
const { chromium } = require(path.join(preview, 'node_modules/playwright-core'));

(async () => {
    const output = path.join(os.tmpdir(), 'ascendant-alchemy-ui');
    await fs.mkdir(output, { recursive: true });
    const { roots } = await discover(path.resolve('RP/ui/alchemical_station.json'), {
        vanillaPack: path.join(preview, '../bedrock-samples/resource_pack'),
    });
    const locale = process.argv.find(arg => arg.startsWith('--locale='))?.slice(9) ?? 'en_US';
    const bundle = await loadPacks(roots, locale);
    const state = {
        variables: { '$desktop_screen': true, '$pocket_screen': false, '$is_pregame': false,
            '$is_gamepad': false, '$touch': false, '$container_title': 'Alchemical Station', '$localize_title': false },
        bindings: { '#container_title': 'Alchemical Station', '#title_text': 'Alchemical Station',
            '#hover_text': '', '#item_name': '', '#item_id_aux': 0, '#item_count': '', '#inventory_stack_count': '',
            '#item_visible': true, '#visible': true, '#enabled': true, '#toggle_state': false, '#toggle_enabled': true,
            '#show_gamepad_helpers': false, '#gamepad_cursor_visible': false, '#mouse_mode': true,
            '#is_using_gamepad': false, '#close_button_visible': true,
            '#container_cell_background_texture': 'textures/ui/slot', '#container_cell_background_texture_file_system': 'InUserPackage',
            '#hotbar_grid_dimensions': [9, 1], '#inventory_grid_dimensions': [9, 3] },
        collections: { container_items: {}, inventory_items: {}, hotbar_items: {} }, controls: {},
        _preview: { name: 'Alchemical Station - Brewing / display', root: 'alchemical_station.utility_panel',
            viewport: { width: 480, height: 270 }, notes: 'Estado inicial derivado dos toggles da UI. Dados ilustrativos; não executa a máquina.' },
    };
    // Native idle inventory state: no bundle, item lock, held item, or gesture.
    for (const binding of ['#gamepad_helper_visible', '#is_selected_slot', '#touch_progress_bar_visible',
        '#item_lock_in_inventory', '#item_lock_in_slot', '#item_lock', '#bundle_selected_item_visible',
        '#bundle_open_back', '#bundle_open_front', '#show_persistent_bundle_hover_text', '#using_touch',
        '#progress_bar_visible', '#item_durability_visible', '#item_storage_visible',
        '#selected_item_durability_visible', '#selected_item_storage_visible',
        '#inventory_selected_item_lock_in_inventory', '#inventory_selected_item_lock_in_slot']) state.bindings[binding] = false;
    state.bindings['#inventory_selected_item'] = 0;
    state.bindings['#inventory_selected_item_stack_count'] = '';
    state.collections.container_items = {
        0: { '#item_id_aux': 1, texture: 'textures/ui/energy_bar/energy_frame_36' },
        1: { '#item_id_aux': 1, '#hover_text': '§r§eBrewing\n§r§fProcessing: 50%\n§r§7Reagent: middle slot\n§r§7Fuel: blaze powder\n§r§7Up to 6 bottles per batch\n\n§r§eAmplify\n§r§fPress the left button to start.\n§r§7Left slot + left button\n§r§7Cost: 1000 mB Aetherium\n\n§r§eExtend\n§r§fPress the right button to start.\n§r§7Right slot + right button\n§r§7Cost: 750 mB Aetherium\n\n§r§eStorage\n§r§fBlaze: 48000 / 64000 mB\n§r§fAetherium: 64000 / 128000 mB\n§r§fEnergy: 1500000 / 2048000 DE' },
        2: { '#item_id_aux': 1, '#hover_text': 'Brewing: 50%§0§a§1§4§r' },
        3: { '#item_id_aux': 1, texture: 'textures/items/nether_wart' },
        10: { '#item_id_aux': 1, texture: 'textures/items/blaze_powder' },
        11: { '#item_id_aux': 1, texture: 'textures/items/ui/blaze/alchemical_blaze_39' },
        12: { '#item_id_aux': 1, texture: 'textures/items/ui/liquified_aetherium_bar/liquified_aetherium_bar_24' },
        17: { '#item_id_aux': 1, texture: 'textures/ui/progress_bar/arrow_right_12' },
        20: { '#item_id_aux': 1, texture: 'textures/ui/progress_bar/arrow_right_12' },
    };
    for (const i of [4, 5, 6, 7, 8, 9, 13, 14]) state.collections.container_items[i] = { '#item_id_aux': 1, texture: 'textures/items/potion_bottle_moveSpeed' };

    // Hydrate only referenced public vanilla item icons absent from the installed mirror.
    const references = new Set(Object.values(state.collections.container_items).map(v => v.texture).filter(Boolean));
    const visit = value => {
        if (typeof value === 'string' && /^textures\/(items|blocks)\//.test(value)) references.add(value);
        else if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    for (const def of Object.values(bundle.definitions)) if (['alchemical_station', 'alchemical_recipes'].includes(def.namespace)) visit(def.value);
    for (const texture of references) {
        if (bundle.textures[texture]) continue;
        const file = path.join(output, 'vanilla', texture + '.png');
        await fs.mkdir(path.dirname(file), { recursive: true });
        try { await fs.access(file); } catch {
            const response = await fetch('https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/' + texture + '.png');
            assert(response.ok, `Vanilla icon unavailable: ${texture} (${response.status})`);
            await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
        }
        bundle.textures[texture] = { file };
    }
    const assets = new Map(); let n = 0;
    for (const entry of Object.values(bundle.textures)) { const url = '/asset/' + n++; assets.set(url, entry.file); entry.url = url; }
    const server = http.createServer(async (req, res) => {
        try {
            let file;
            if (assets.has(req.url)) file = assets.get(req.url);
            else if (['/engine.js', '/renderer.js'].includes(req.url)) file = path.join(preview, 'media', req.url.slice(1));
            else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#26313a"><canvas id="canvas"></canvas><script src="/engine.js"></script><script src="/renderer.js"></script>'); return; }
            res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'text/javascript; charset=utf-8');
            let body = await fs.readFile(file);
            if (req.url === '/engine.js') {
                // This installed Preview version omits the two native locked-hover
                // variants from its painter's selector. Complete that selector only;
                // source geometry, bindings, controls and textures remain untouched.
                body = body.toString('utf8').replaceAll("'checked_locked','unchecked_locked']", "'checked_locked','unchecked_locked','checked_locked_hover','unchecked_locked_hover']");
                // Honor native propagate_alpha; the installed Preview always propagates it.
                body = body.replace('this.layout(child,parentBox,node.z,node.alpha,childClip);', 'this.layout(child,parentBox,node.z,p.propagate_alpha === false ? alpha : node.alpha,childClip);');
            }
            res.end(body);
        } catch (error) { res.writeHead(500); res.end(String(error)); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
        await page.goto('http://127.0.0.1:' + server.address().port);
        const defaults = await page.evaluate(({ bundle, state }) => {
            const engine = new BedrockEngine.Engine(bundle, state), result = engine.build('alchemical_station.utility_panel', 480, 270);
            // Open/close controls in shared panels reuse a name. The initial opener
            // defines the default; a hidden close control must not overwrite it.
            const defaults = {};
            for (const n of result.nodes.filter(n => n.p.type === 'toggle')) {
                defaults[n.name] ??= { '#toggle_state': n.p.toggle_default_state ?? false };
            }
            return defaults;
        }, { bundle, state });
        state.controls = defaults;
        await fs.writeFile('RP/ui/alchemical_station.preview.json', JSON.stringify(state, null, 4) + '\n');
        const report = [];
        const modes = [
            ['brewing-display', false, 'display', false], ['brewing-recipes', false, 'recipes', false],
            ['brewing-progression', false, 'progression', false], ['brewing-hidden', false, 'recipes', true],
            ['aplifying-display', true, 'display', false], ['aplifying-recipes', true, 'recipes', false],
            ['aplifying-progression', true, 'progression', false], ['aplifying-hidden', true, 'display', true],
        ];
        const cases = modes.map(m => [...m, 480, 270]);
        cases.push(...modes.map(([name, ...m]) => [name + '-small', ...m, 360, 240]));
        cases.push(['brewing-progression-bottom', false, 'progression', false, 480, 270],
            ['brewing-recipes-bottom', false, 'recipes', false, 480, 270],
            ['brewing-recipes-bottom-small', false, 'recipes', false, 360, 240],
            ['brewing-recipes-long-names', false, 'recipes', false, 480, 270],
            ['brewing-progression-hover', false, 'progression', false, 480, 270],
            ['brewing-progression-ingredient-hover', false, 'progression', false, 480, 270],
            ['brewing-recipes-hover', false, 'recipes', false, 480, 270],
            ['aplifying-action-hover', true, 'display', false, 480, 270]);
        cases.push(['machine-information', false, 'display', false, 480, 270], ['machine-information-small', false, 'display', false, 360, 240]);
        for (const panel of ['upgrades', 'io', 'io-fluid']) cases.push([`machine-${panel}`, false, 'display', false, 480, 270], [`machine-${panel}-small`, false, 'display', false, 360, 240]);
        const requested = process.argv.slice(2).filter(arg => arg.startsWith('--case=')).map(arg => arg.slice(7));
        for (const [name, aplifying, sidePage, hidden, width, height] of cases.filter(c => !requested.length || requested.includes(c[0]))) {
            const preset = structuredClone(state);
            // The first render uses only source-derived defaults.
            if (name !== 'brewing-display') Object.assign(preset.controls, {
                alchemy_brewing_tab: { '#toggle_state': !aplifying }, alchemy_aplifying_tab: { '#toggle_state': aplifying },
                alchemy_display_tab: { '#toggle_state': sidePage === 'display' },
                alchemy_recipes_tab: { '#toggle_state': sidePage === 'recipes' },
                alchemy_progression_tab: { '#toggle_state': sidePage === 'progression' },
                alchemy_panels_hidden: { '#toggle_state': hidden },
                info_toggle_button: { '#toggle_state': name.startsWith('machine-information') },
                upgrade_toggle_button: { '#toggle_state': name.startsWith('machine-upgrades') },
                io_toggle_button: { '#toggle_state': name.startsWith('machine-io') },
                io_items_toggle_button: { '#toggle_state': !name.startsWith('machine-io-fluid') },
                io_fluids_toggle_button: { '#toggle_state': name.startsWith('machine-io-fluid') },
            });
            await page.setViewportSize({ width: width * 3, height: height * 3 });
            const result = await page.evaluate(({ bundle, preset, width, height, name }) => {
                if (window.engine?.viewport?.w === width && engine.viewport.h === height) {
                    engine.state = preset;
                    engine.updateControls();
                    window.result = { nodes: engine.nodes, warnings: [...engine.warnings] };
                } else {
                    window.engine = new BedrockEngine.Engine(bundle, preset);
                    window.result = engine.build('alchemical_station.utility_panel', width, height);
                }
                for (const view of engine.nodes.filter(n => n.scroll && n.path.includes('/side_panels/'))) {
                    engine.scrollTo(view, name.includes('bottom') || name.includes('progression-') && name.includes('hover') ? view.scroll.max : 0);
                    if (name === 'brewing-recipes-long-names') {
                        const card = engine.nodes.find(n => n.name === 'recipe_40');
                        engine.scrollTo(view, card.box.y - view.box.y);
                    }
                }
                if (name.includes('hover')) {
                    const button = engine.nodes.find(n => !n.hidden && n.p.type === 'button' && (
                        name === 'aplifying-action-hover' ? n.name === 'button' && n.path.includes('/amplify_button/') :
                        n.name === 'hover' && n.path.includes(name.includes('recipes') ? '/recipe_0/' : '/stage_maximum/') &&
                        n.path.includes(name.includes('ingredient-hover') ? '/ingredient/' : name.includes('recipes') ? '/input/' : '/potion/')
                    ));
                    if (!button) throw Error('Missing hover target: ' + name);
                    preset.controls[button.path] = { '#hover': true };
                    engine.state = preset; engine.updateControls();
                }
                // The installed preview does not implement allow_clipping=false.
                // Apply the source tooltip's explicit clipping escape for its subtree.
                for (const node of engine.nodes) {
                    let ancestor = node;
                    while (ancestor && ancestor.p.allow_clipping !== false) ancestor = ancestor.parent;
                    if (ancestor) node.clip = null;
                }
                window.renderer = new BedrockRenderer.Renderer(document.querySelector('canvas'), bundle, preset);
                renderer.resize(width, height, 3); renderer.draw(result.nodes);
                return { warnings: result.warnings, nodes: result.nodes.filter(n => !n.hidden).map(n => ({ name: n.name, path: n.path, type: n.p.type, box: n.box, index: n.index, collection: n.collection, renderer: n.p.renderer, text: n.p.text, texture: n.p.texture, color: n.p.color, buttonMappings: n.p.button_mappings })) };
            }, { bundle, preset, width, height, name });
            await page.waitForFunction(() => [...renderer.images.values()].every(i => i.complete));
            await page.evaluate(() => renderer.draw(result.nodes));
            await page.screenshot({ path: path.join(output, name + '.png') });
            result.renderWarnings = await page.evaluate(() => [...renderer.warnings]);
            await fs.writeFile(path.join(output, name + '.json'), JSON.stringify({ defaults, preset, ...result }, null, 2));
            const has = control => result.nodes.some(node => node.name === control);
            assert.equal(result.nodes.some(n => n.name === 'ingredient' && n.path.includes('/brewing/')), !aplifying, name + ': brewing isolation');
            assert.equal(has('amplify_slot'), aplifying, name + ': aplifying isolation');
            assert.equal(has('display'), !hidden && sidePage === 'display', name + ': display state');
            assert.equal(has('recipes'), !hidden && sidePage === 'recipes', name + ': recipes state');
            assert.equal(has('progression'), !hidden && sidePage === 'progression', name + ': progression state');
            assert.equal(has('side_panels'), !hidden, name + ': hidden panel state');
            if (!hidden) {
                const tabs = ['alchemy_display_tab', 'alchemy_recipes_tab', 'alchemy_progression_tab'].map(control => result.nodes.find(n => n.name === control));
                const hide = result.nodes.find(n => n.name === 'alchemy_panels_hidden');
                assert(tabs.every(Boolean), name + ': three side tabs');
                for (let i = 0; i < tabs.length - 1; i++) assert(tabs[i].box.x + tabs[i].box.w <= tabs[i + 1].box.x, name + ': side tab spacing');
                assert(tabs[2].box.x + tabs[2].box.w <= hide.box.x, name + ': tabs clear the hide button');
            }
            if (name.includes('hover')) assert(result.nodes.some(n => n.type === 'label' && n.path.includes('/hover/') && n.text && !n.text.startsWith('ui.ascendant:') && !n.text.startsWith('$')),
                name + ': localized tooltip text');
            assert(has('info_toggle_button'), name + ': machine information button');
            assert.equal(has('info_panel'), name.startsWith('machine-information'), name + ': machine information panel');
            const rightButtons = ['upgrade_toggle_button', 'io_toggle_button', 'info_toggle_button']
                .map(control => result.nodes.find(n => n.name === control));
            assert(rightButtons.every(Boolean), name + ': three shared machine buttons');
            assert.equal(rightButtons[1].box.y - rightButtons[0].box.y, 26, name + ': upgrade / IO cadence');
            assert.equal(rightButtons[2].box.y - rightButtons[1].box.y, 26, name + ': IO / information cadence');
            assert.equal(rightButtons[1].box.x, rightButtons[0].box.x, name + ': aligned buttons');
            assert.equal(rightButtons[2].box.x, rightButtons[0].box.x, name + ': aligned information button');
            const barButtons = result.nodes.filter(n => /\/(blaze|energy|aetherium)\/.+\/item_button_ref$/.test(n.path));
            assert(barButtons.length >= 2, name + ': visible gauges');
            assert(barButtons.every(n => !n.buttonMappings?.length), name + ': gauges cannot dispatch inventory actions');
            assert(!result.renderWarnings.some(w => /Missing texture|Could not load|Rendering error/.test(w)), name + ': texture rendering');
            const nativeTogglePlaceholder = /^Missing definition: common\.(un)?checked(_hover|_locked|_locked_hover)?$/;
            assert(!result.warnings.some(w => w.startsWith('Missing definition:') && !nativeTogglePlaceholder.test(w)), name + ': UI references');
            for (const control of ['root_panel', 'side_panels', 'alchemy_brewing_tab', 'alchemy_aplifying_tab', 'alchemy_panels_hidden', 'info_background']) {
                const n = result.nodes.find(n => n.name === control);
                if (n) assert(n.box.x >= 0 && n.box.y >= 0 && n.box.x + n.box.w <= width && n.box.y + n.box.h <= height,
                    name + ': viewport fit: ' + control);
            }
            if (!aplifying) {
                const bottles = result.nodes.filter(node => /^bottle_[0-5]$/.test(node.name));
                assert.equal(bottles.length, 6); assert.deepEqual(bottles.map(node => node.index), [4, 5, 6, 7, 8, 9]);
                for (let i = 0; i < 6; i += 2) { assert.equal(bottles[i + 1].box.y - bottles[i].box.y, 20); assert.equal(bottles[i + 1].box.x, bottles[i].box.x); }
                assert.equal(bottles[2].box.x - bottles[0].box.x, 20); assert.equal(bottles[4].box.x - bottles[2].box.x, 20);
                const blaze = result.nodes.find(node => node.name === 'blaze'); assert.equal(blaze.box.w, 6); assert.equal(blaze.box.h, 54);
            }
            const labels = result.nodes.filter(node => node.type === 'label' && node.text && !node.path.includes('/side_panels/') && !node.path.includes('/information/') && !node.path.includes('/io/') && !node.path.includes('/upgrades/') && !node.path.includes('/hover'));
            assert(labels.every(node => node.name === 'title'), name + ': no extra main labels: ' + labels.map(n => n.name));
            report.push({ name, ...result });
            console.log('PASS ' + name);
        }
        await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ output, cases: report.map(r => ({ name: r.name, renderWarnings: r.renderWarnings, warnings: r.warnings.filter(w => /Missing definition|Unresolved|ReferenceError/.test(w)) })) }, null, 2));
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
