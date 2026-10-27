const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const preview = path.join(os.homedir(), 'AppData/Local/DoriosStudios/Bedrock-UI-Preview/source');
const { discover, loadPacks } = require(path.join(preview, 'lib/loader.cjs'));
const { chromium } = require(path.join(preview, 'node_modules/playwright-core'));

(async () => {
    const vanilla = 'F:/Downloads/bedrock-samples-v1.26.30.5-full/resource_pack';
    const { roots } = await discover(path.resolve('RP/ui/catalyst_weaver.json'), { vanillaPack: vanilla });
    const bundle = await loadPacks(roots, 'en_US');
    const preset = JSON.parse(await fs.readFile('RP/ui/alchemical_station.preview.json', 'utf8'));
    preset.variables.$container_title = 'Catalyst Weaver';
    preset.bindings['#container_title'] = preset.bindings['#title_text'] = 'Catalyst Weaver';
    preset.collections.container_items = { 1: { '#hover_text': '§eStatus: §aReady\n\n§eMachine Information\n\n§aSpeed §fx1.00\n§aEfficiency §fx1.00\n§aRecipe Batch §fx1\n\n§eEnergy Information\n\n§bStored §f1.5 M / 2 M DE\n§bRate §f128 DE/t\n\n§eCatalysts\n\n§7Insert a base material and catalysts.\n§7Choose a recipe for more details.\n\n§eFluid Information\n\n§bLiquified Aetherium §f32,000 mB' } };
    preset.controls = {};
    // The installed bitmap font painter does not implement Bedrock section-sign
    // colors. Keep this illustrative fixture readable; production text is intact.
    preset.collections.container_items[1]['#hover_text'] = preset.collections.container_items[1]['#hover_text'].replace(/§./g, '');
    const palettes = ['default', 'brown', 'blue', 'green', 'orange', 'purple', 'aqua', 'red', 'white', 'yellow'];
    const icons = ['textures/ui/inventory_icon', 'textures/ui/recipe_book_icon',
        'textures/ui/at_icons/crafting_table', 'textures/ui/at_icons/titanium_stabilized'];
    const cases = [];
    for (const count of [2, 4, 8, 12]) for (const width of [480, 360]) {
        const name = `card-${count}-${width}`;
        const row = `row_${count}`;
        bundle.definitions[`card_preview.${row}`] = { namespace: 'card_preview', key: `${row}@at_core.button_card_row`, file: '(preview)', value: {
            controls: Array.from({ length: count }, (_, i) => ({ [`tab_${i}@at_common.card_tab`]: {
                '$card_tab_index': i, '$toggle_name': 'preview_tabs', '$card_icon': icons[i % icons.length],
                '$card_tooltip': `Tab ${i + 1}`, '$card_unchecked_texture': `textures/ui/button_card/button_${palettes[i % palettes.length]}`,
                '$card_checked_texture': `textures/ui/button_card/button_${palettes[i % palettes.length]}_pressed`,
                '$card_unchecked_hover_texture': `textures/ui/button_card/button_${palettes[i % palettes.length]}_hover`,
                '$card_checked_hover_texture': `textures/ui/button_card/button_${palettes[i % palettes.length]}_pressed_hover`,
            } })),
        } };
        bundle.definitions[`card_preview.${name}`] = { namespace: 'card_preview', key: name, file: '(preview)', value: {
            type: 'panel', controls: [{ 'card@at_common.button_card': { anchor_from: 'bottom_right', anchor_to: 'bottom_right', offset: [-12, -10],
                '$card_buttons_ref': `card_preview.${row}`, '$card_background_texture': 'textures/ui/button_card/background_brown' } }],
        } };
        cases.push({ name, ref: `card_preview.${name}`, count, width, height: 80 });
    }
    // Also exercise optional close removal and a native action button.
    bundle.definitions['card_preview.action_row'] = { namespace: 'card_preview', key: 'action_row@at_core.button_card_row', file: '(preview)', value: {
        controls: [{ 'action@at_common.card_button': { '$card_icon': icons[2], '$pressed_button_name': 'button.card_test', '$card_tooltip': 'Action' } }],
    } };
    bundle.definitions['card_preview.action_card'] = { namespace: 'card_preview', key: 'action_card@at_common.button_card', file: '(preview)', value: {
        anchor_from: 'bottom_right', anchor_to: 'bottom_right', offset: [-12, -10], '$card_buttons_ref': 'card_preview.action_row', '$card_show_close': false,
        '$card_background_texture': 'textures/ui/button_card/background_blue',
    } };
    cases.push({ name: 'card-action-hover', ref: 'card_preview.action_card', count: 1, width: 360, height: 80, noClose: true, hover: true });
    cases.push({ name: 'card-action-pressed', ref: 'card_preview.action_card', count: 1, width: 360, height: 80, noClose: true, pressed: true });
    cases.push({ name: 'card-checked-hover', ref: 'card_preview.card-4-480', count: 4, width: 480, height: 80, hover: true, checked: 2 });
    cases.push({ name: 'catalyst-weaver-display', ref: 'catalyst_weaver.utility_panel', width: 480, height: 270, machine: true });
    cases.push({ name: 'catalyst-weaver-recipes', ref: 'catalyst_weaver.utility_panel', width: 480, height: 270, machine: true, recipes: true });

    for (const [station, color, tabs, pages] of [
        ['enchantment_station', 'green', ['station_enchant_tab', 'station_disenchant_tab'], ['enchant_page', 'disenchant_page']],
        ['refining_table', 'purple', ['refining_main_tab', 'stats_toggle'], ['main_content', 'stats_content']],
        ['alchemical_station', 'brown', ['alchemy_brewing_tab', 'alchemy_aplifying_tab'], ['brewing', 'aplifying']],
        ['cryo_chamber', 'aqua', ['freezing_tab', 'generation_tab', 'stabilization_tab'], ['freezing_page', 'generation_page', 'stabilization_page']],
    ]) for (const selected of (station === 'cryo_chamber' ? [0, 1, 2] : [0, 1])) for (const width of [480, 360]) {
        cases.push({ name: station + '-' + selected + '-' + width, ref: station + '.utility_panel', station, color, tabs, pages, selected, width, height: 270 });
    }

    bundle.definitions['card_preview.inline_card'] = { namespace: 'card_preview', key: 'inline_card@at_common.button_card', file: '(preview)', value: {
        anchor_from: 'bottom_right', anchor_to: 'bottom_right', offset: [-12, -10],
        '$card_buttons_ref': 'card_preview.row_4', '$card_show_background': false, '$card_show_close': false,
    } };
    cases.push({ name: 'card-inline', ref: 'card_preview.inline_card', count: 4, width: 480, height: 80, noClose: true, hiddenBackground: true });
    const assets = new Map(); let counter = 0;
    for (const entry of Object.values(bundle.textures)) { const url = '/asset/' + counter++; assets.set(url, entry.file); entry.url = url; }
    const server = http.createServer(async (req, res) => {
        try {
            const file = assets.get(req.url) || (['/engine.js', '/renderer.js'].includes(req.url) ? path.join(preview, 'media', req.url.slice(1)) : null);
            if (!file) { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><body style="margin:0"><canvas id="canvas"></canvas><script src="/engine.js"></script><script src="/renderer.js"></script>'); return; }
            res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'text/javascript');
            let body = await fs.readFile(file);
            if (req.url === '/engine.js') {
                // The installed Preview omits these two native toggle variants.
                // Complete only its visual selector; no production UI is changed.
                body = body.toString('utf8').replaceAll("'checked_locked','unchecked_locked']", "'checked_locked','unchecked_locked','checked_locked_hover','unchecked_locked_hover']");
                // Honor native propagate_alpha; the installed Preview always propagates it.
                body = body.replace('this.layout(child,parentBox,node.z,node.alpha,childClip);', 'this.layout(child,parentBox,node.z,p.propagate_alpha === false ? alpha : node.alpha,childClip);');
            }
            res.end(body);
        } catch (error) { res.writeHead(500); res.end(String(error)); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const output = path.resolve('docs/previews/button-card');
    await fs.mkdir(output, { recursive: true });
    try {
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.evaluate(bundle => { window.previewBundle = bundle; }, bundle);
        const report = [];
        const requested = process.argv.slice(2).filter(a => a.startsWith('--case=')).map(a => a.slice(7));
        for (const test of cases.filter(c => !requested.length || requested.includes(c.name))) {
            const state = structuredClone(preset);
            if (test.station) {
                const title = { enchantment_station: 'Enchantment Station', refining_table: 'Refining Table', alchemical_station: 'Alchemical Station', cryo_chamber: 'Cryo Chamber' }[test.station];
                state.variables.$container_title = title;
                state.bindings['#container_title'] = state.bindings['#title_text'] = title;
                for (const [i, name] of test.tabs.entries()) state.controls[name] = { '#toggle_state': i === test.selected };
                Object.assign(state.controls, { alchemy_display_tab: { '#toggle_state': true }, alchemy_recipes_tab: { '#toggle_state': false }, alchemy_progression_tab: { '#toggle_state': false }, alchemy_panels_hidden: { '#toggle_state': false } });
                state.adapters = { controls: { recipes: { ignored: true }, progression: { ignored: true } } };
            } else if (test.machine) {
                state.controls.recipes_toggle_button = { '#toggle_state': !!test.recipes };
                state.controls.machine_view_toggle_button = { '#toggle_state': !test.recipes };
                // This preview focuses on the machine/display and card. The
                // large recipe book is omitted to stay within Preview's cap.
                state.adapters = { controls: { recipes_side_panel: { ignored: true },
                    [test.recipes ? 'normal_content' : 'recipes_content']: { ignored: true } } };
            } else {
                for (let i = 0; i < test.count; i++) state.controls[`tab_${i}`] = { '#toggle_state': i === (test.checked ?? 0), '#hover': test.hover && i === test.checked };
                state.controls.action = { '#hover': !!test.hover, '#pressed': !!test.pressed };
            }
            await page.setViewportSize({ width: test.width * 3, height: test.height * 3 });
            const result = await page.evaluate(({ state, test }) => {
                const bundle = window.previewBundle;
                const engine = new BedrockEngine.Engine(bundle, state);
                const result = engine.build(test.ref, test.width, test.height);
                // Preview permits numeric variables inside size components and
                // resolves aliases after merging leaf defaults. Bedrock's log
                // reports both as errors, so check those native constraints
                // before trusting the preview geometry.
                const contractErrors = [];
                for (const n of result.nodes) {
                    for (const part of Array.isArray(n.raw.size) ? n.raw.size : []) {
                        if (typeof part !== 'string' || !/^\$card_\w+$/.test(part)) continue;
                        const value = n.vars[part];
                        if (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value))) {
                            contractErrors.push(`${n.path}: size component ${part} has no unit; pass a complete size vector`);
                        }
                    }
                    const textureRef = n.raw.$card_face_texture;
                    if (typeof textureRef === 'string' && /^\$card_\w+$/.test(textureRef)
                        && !Object.hasOwn(n.parent?.vars ?? {}, textureRef)) {
                        contractErrors.push(`${n.path}: ${textureRef} is missing from the ancestor scope`);
                    }
                }
                // Respect the source tooltip's clipping escape, unsupported by
                // the installed Preview. No source geometry/bindings are changed.
                for (const n of engine.nodes) {
                    let a = n; while (a && a.p.allow_clipping !== false) a = a.parent;
                    if (a) n.clip = null;
                }
                window.renderNodes = result.nodes;
                const renderer = window.renderer = new BedrockRenderer.Renderer(document.querySelector('canvas'), bundle, state);
                renderer.resize(test.width, test.height, 3); renderer.draw(result.nodes);
                return { contractErrors, warnings: result.warnings, renderWarnings: [...renderer.warnings], nodes: result.nodes.map(n => ({
                    name: n.name, path: n.path, box: n.box, hidden: n.hidden, alpha: n.alpha, namespace: n.namespace, type: n.p.type,
                    text: n.p.text, texture: n.p.texture, index: n.index, renderer: n.p.renderer, radio: n.p.radio_toggle_group,
                    tabIndex: n.p.toggle_group_forced_index, defaultState: n.p.toggle_default_state,
                    groupDefault: n.p.toggle_group_default_selected,
                    mappings: n.raw.button_mappings, modifications: n.raw.modifications, rendererAncestor: !!n.parent?.vars?.$renderer_size && !!n.parent?.vars?.$renderer_offset,
                })) };
            }, { state, test });
            await page.waitForFunction(() => [...renderer.images.values()].every(i => i.complete));
            result.renderWarnings = await page.evaluate(() => { renderer.draw(renderNodes); return [...renderer.warnings]; });
            assert.deepEqual(result.contractErrors, [], result.contractErrors.join('\n'));
            assert(!result.warnings.some(w => /Expansion limit|Circular inheritance|Variable: \$card_|Missing definition: (at_common|at_core|catalyst_weaver|cryo_chamber)/.test(w)), result.warnings.join('\n'));
            assert(!result.renderWarnings.some(w => /Missing texture|Could not load|Rendering error/.test(w)), result.renderWarnings.join('\n'));
            assert(result.nodes.filter(n => ['at_common', 'at_core'].includes(n.namespace)).every(n => !n.modifications), 'Shared controls must not inherit modifications');
            const visibleCard = result.nodes.find(n => ['card', 'view_top_bar'].includes(n.name) && !n.hidden) || result.nodes[0];
            const content = result.nodes.find(n => n.name === 'content' && n.path.startsWith(visibleCard.path) && !n.hidden);
            assert.equal(content.box.y, visibleCard.box.y + 4, 'Button row moves one pixel down');
            if (!test.noClose) {
                const cell = result.nodes.find(n => n.name === 'close_cell' && n.path.startsWith(visibleCard.path) && !n.hidden);
                const close = result.nodes.find(n => n.name === 'close' && n.path.startsWith(cell.path) && !n.hidden);
                assert.deepEqual(close.box, cell.box, 'Close button is centered and fills its cell');
            }
            if (test.station) {
                assert.equal(visibleCard.box.w, test.tabs.length * 26 + 26);
                assert.equal(visibleCard.box.h, 27);
                const tabs = result.nodes.filter(n => n.type === 'toggle' && n.path.startsWith(visibleCard.path));
                assert.deepEqual(tabs.map(n => n.name), test.tabs);
                assert.deepEqual(tabs.map(n => n.tabIndex), test.tabs.map((_, i) => i));
                assert(tabs.every(n => n.radio && n.groupDefault === 0 && n.mappings?.length));
                assert(result.nodes.some(n => n.name === 'background' && n.path.startsWith(visibleCard.path) && n.texture === 'textures/ui/button_card/tab_top_' + test.color));
                for (const [i, name] of test.pages.entries()) {
                    const page = result.nodes.find(n => n.name === name);
                    assert(page, 'Page exists: ' + name);
                    assert.equal(page.hidden, i !== test.selected, 'Page selection: ' + name);
                }
                const shellName = { enchantment_station: 'station_shell', refining_table: 'view_top_bar_anchor', alchemical_station: 'station_top', cryo_chamber: 'cryo_chamber_main' }[test.station];
                const shell = result.nodes.find(n => n.name === shellName && !n.hidden);
                assert.equal(visibleCard.box.x + visibleCard.box.w, shell.box.x + shell.box.w, 'Card right edge matches body');
                assert.equal(visibleCard.box.y + visibleCard.box.h, shell.box.y + 4, 'Same tab foot overlap as Catalyst Weaver');
                if (test.station === 'cryo_chamber') {
                    const body = result.nodes.find(n => n.name === 'cryo_chamber_main');
                    const frozen = result.nodes.find(n => n.name === 'freezer_screen');
                    assert.deepEqual([body.box.w, body.box.h], [176, 166]);
                    assert.equal(frozen?.texture, 'textures/ui/frozen_panel_ls');
                    assert.deepEqual([frozen.box.w, frozen.box.h], [176, 166]);
                    assert.equal(frozen.hidden, test.selected !== 0);
                    assert(!result.nodes.some(n => ['water_input', 'cryofluid_output'].includes(n.name)), 'Removed container slots are absent');
                    const inventorySlots = result.nodes.filter(n => n.name === 'bg' && n.texture === 'textures/ui/cells/cyan_cell_image' && n.path.includes('/dark_inventory_panel/inventory_panel/inventory_grid/'));
                    const hotbarSlots = result.nodes.filter(n => n.name === 'bg' && n.texture === 'textures/ui/cells/cyan_cell_image' && n.path.includes('/dark_hotbar_grid/'));
                    assert.equal(inventorySlots.length, 27, 'Dark cyan inventory grid has 27 cells');
                    assert.equal(hotbarSlots.length, 9, 'Dark cyan hotbar has 9 cells');
                }
                if (test.station === 'enchantment_station') {
                    const itemSlots = result.nodes.filter(n => n.namespace === 'enchantment_station' && /^(target_|output_|source$)/.test(n.name));
                    assert.equal(itemSlots.length, 19);
                    assert(itemSlots.every(n => n.rendererAncestor), 'Slot renderer variables exist in ancestor scope');
                }
                assert(visibleCard.box.x >= 0 && visibleCard.box.y >= 0, 'Card fits viewport');
                if (test.station === 'alchemical_station') {
                    const side = result.nodes.find(n => n.name === 'side_view_top_bar' && !n.hidden);
                    const hide = result.nodes.find(n => n.name === 'alchemy_panels_hidden' && !n.hidden);
                    assert.equal(side.box.w, 86);
                    assert(result.nodes.some(n => n.name === 'background' && n.path === side.path + '/background' && n.alpha === 1), 'Side card background restored');
                    assert(!result.nodes.some(n => n.name === 'close' && n.path.startsWith(side.path)), 'Inline card has no close button');
                    assert(side.box.x + side.box.w <= hide.box.x, 'Side card clears hide control');
                    assert.equal(result.nodes.filter(n => n.type === 'toggle' && n.path.startsWith(side.path)).length, 3);
                }
            } else if (test.machine) {
                const card = result.nodes.find(n => n.name === 'view_top_bar' && !n.hidden);
                assert(card && card.box.w === 78, 'Catalyst Weaver card width');
                assert.equal(card.box.h, 27, 'Catalyst Weaver background is four pixels taller');
                assert(result.nodes.some(n => n.name === 'background' && n.path.startsWith(card.path)
                    && n.texture === 'textures/ui/TabTopBackRightMostDark'), 'Vanilla tab background');
                const cardTabs = result.nodes.filter(n => n.type === 'toggle' && n.path.startsWith(card.path));
                assert.equal(cardTabs.length, 2);
                assert(cardTabs.every(n => n.groupDefault === 0), 'Shared machine/recipe group has one consistent initial page');
                const machine = result.nodes.find(n => n.path.endsWith('/catalyst_weaver_top/screen') && !n.hidden);
                assert.equal(card.box.y, machine.box.y - 23, 'Entire card moves two pixels up');
                assert.equal(card.box.y + card.box.h, machine.box.y + 4, 'Background bottom follows the raised card');
                assert.equal(card.box.x + card.box.w, machine.box.x + machine.box.w, 'Card aligns with the machine right edge');
                const normal = result.nodes.find(n => n.name === 'normal_content');
                const recipes = result.nodes.find(n => n.name === 'recipes_content');
                assert.equal(normal?.hidden ?? true, !!test.recipes); assert.equal(recipes?.hidden ?? true, !test.recipes);
                if (!test.recipes) {
                    const text = result.nodes.find(n => n.name === 'label_v1' && n.path.includes('/info_scroll/') && !n.hidden);
                    assert(text && text.text.includes('Machine Information') && text.box.h > 100, 'Visible scrollable machine status');
                    assert.equal(text.index, 1);
                }
            } else {
                const card = result.nodes.find(n => n.name === 'card') || result.nodes[0];
                assert.equal(card.box.w, test.count * 26 + 8 + (test.noClose ? 0 : 18), 'Width follows button count');
                assert.equal(card.box.h, 27, 'Card height');
                assert.equal(card.box.y, test.height - 37, 'Entire fixture card moves two pixels up');
                assert.equal(card.box.x + card.box.w, test.width - 12, 'Right edge stays fixed');
                assert(card.box.x >= 0, 'Card fits the fixture viewport');
                const tabs = result.nodes.filter(n => n.type === 'toggle');
                assert.equal(result.nodes.filter(n => n.name === 'icon' && !n.hidden).length, test.count, 'One visible icon per button');
                assert.deepEqual(tabs.map(n => n.tabIndex), Array.from({ length: tabs.length }, (_, i) => i));
                assert(tabs.every(n => n.radio === true && n.mappings?.length), 'Native radio selection/input mappings');
                if (test.hiddenBackground) {
                    assert.equal(result.nodes.find(n => n.path === visibleCard.path + '/background').alpha, 0, 'Background transparent');
                    assert(tabs.every(n => n.alpha === 1), 'Transparent background keeps buttons opaque');
                }
                if (test.noClose) assert(!result.nodes.some(n => n.name === 'close'), 'Optional close is removed from layout');
                if (test.hover) assert(result.nodes.some(n => n.name === 'tooltip' && !n.hidden), 'Hover tooltip');
            }
            await page.locator('canvas').screenshot({ path: path.join(output, test.name + '.png') });
            report.push({ name: test.name, warnings: result.warnings, renderWarnings: result.renderWarnings,
                cards: result.nodes.filter(n => ['card', 'view_top_bar'].includes(n.name) && !n.hidden).map(n => n.box) });
            console.log('PASS ' + test.name);
        }
        await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Preview geometry/binding checks only; in-game acceptance requires a fresh Bedrock load.');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
