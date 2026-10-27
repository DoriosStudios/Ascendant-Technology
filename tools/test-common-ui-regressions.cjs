// Focused checks for the inherited-modifications failure reported by Bedrock.
// Uses the installed Preview to resolve native templates; it does not run Bedrock.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { readFile } = require('node:fs/promises');
const preview = path.join(os.homedir(), 'AppData/Local/DoriosStudios/Bedrock-UI-Preview');
const { discover, loadPacks } = require(path.join(preview, 'source/lib/loader.cjs'));
const { Engine } = require(path.join(preview, 'source/media/engine.js'));

function state() {
    return {
        variables: { '$desktop_screen': true, '$pocket_screen': false, '$is_pregame': false,
            '$is_gamepad': false, '$touch': false, '$container_title': 'Machine', '$localize_title': false },
        bindings: { '#visible': true, '#enabled': true, '#toggle_enabled': true, '#toggle_state': false,
            '#mouse_mode': true, '#is_using_gamepad': false, '#close_button_visible': true,
            '#item_visible': true, '#item_id_aux': 0, '#item_count': '', '#hover_text': '',
            '#container_cell_background_texture': 'textures/ui/slot',
            '#container_cell_background_texture_file_system': 'InUserPackage',
            '#inventory_grid_dimensions': [9, 3], '#hotbar_grid_dimensions': [9, 1],
            '#show_persistent_bundle_hover_text': false },
        collections: { container_items: { 1: { '#hover_text': Array.from({ length: 40 },
            (_, i) => `Status line ${i + 1}: catalyst processing`).join('\n') } },
            inventory_items: {}, hotbar_items: {} },
        controls: { recipes_toggle_button: { '#toggle_state': false } },
    };
}

function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
function one(nodes, predicate, description) {
    const found = nodes.filter(predicate);
    assert.equal(found.length, 1, description);
    return found[0];
}
function build(bundle, ref, preset = state()) {
    const engine = new Engine(bundle, preset);
    const result = engine.build(ref, 480, 270);
    // Preview silently processes modifications. Inspect raw controls too, so it
    // cannot hide the same unsupported property reported by the real game.
    for (const node of result.nodes.filter(n => ['at_common', 'at_core'].includes(n.namespace))) {
        assert(!Object.hasOwn(node.raw, 'modifications'), `Inherited modifications: ${node.path}`);
    }
    assert(!result.warnings.some(w => /Expansion limit|Circular inheritance|Variable: \$(content_ref|has_scroll|toggle_show_focus|background_ref|outline_texture)/.test(w)),
        result.warnings.join('\n'));
    return { engine, ...result };
}

(async () => {
    for (const file of ['at_common', 'at_core']) JSON.parse(await readFile(`RP/ui/${file}.json`, 'utf8'));
    const common = JSON.parse(await readFile('RP/ui/at_common.json', 'utf8'));
    // Bedrock replaces a derived controls array; Preview merges by child name.
    // Check the effective native list too, so a scroll-only override cannot
    // silently remove the frame while this preview still renders it.
    const infoControls = common['scrollable_info_panel@at_common.info_panel'].controls ?? common.info_panel.controls;
    const infoChildNames = infoControls.flatMap(c => Object.keys(c).map(k => k.split('@')[0]));
    assert(infoChildNames.includes('background') && infoChildNames.includes('screen'), 'Native scrollable frame retains its background and inner screen');
    const { roots } = await discover(path.resolve('RP/ui/catalyst_weaver.json'), {
        vanillaPack: path.join(preview, 'bedrock-samples/resource_pack'),
    });
    const bundle = await loadPacks(roots, 'en_US');
    // Bedrock can resolve a duplicated name to the outer panel, which has no
    // #toggle_state. The preview's state map alone cannot detect this collision.
    const books = JSON.parse(await readFile('RP/ui/recipes/machine_books.json', 'utf8'));
    const recipeToggles = new Set(), recipeTargets = [];
    function checkRecipeNames(value) {
        if (!value || typeof value !== 'object') return;
        for (const [name, child] of Object.entries(value)) {
            if (name.endsWith('@uc.recipe_toggle')) {
                const target = child.$toggle_control_name;
                assert.notEqual(name.split('@')[0], target, 'Recipe wrapper must not shadow its inner toggle');
                assert(!recipeToggles.has(target), 'Recipe toggle names must be unique');
                recipeToggles.add(target);
            }
            if (name.endsWith('@uc.recipe_panel')) recipeTargets.push(child.$recipe_control_name);
            checkRecipeNames(child);
        }
    }
    checkRecipeNames(books);
    assert(recipeTargets.length > 0);
    for (const target of recipeTargets) assert(recipeToggles.has(target), 'Recipe visibility targets an existing inner toggle');
    // The AT presentation keeps both UC toggles, including focus, grouping,
    // dismissal and mappings. Only the help panel's geometry is customized.
    const nativeInfo = new Engine(bundle, state()).definition('uc.info_tab', 'uc');
    for (const show of [false, true]) {
        const panelState = state();
        panelState.variables.$show_close = show;
        panelState.variables.$close_button_ref = 'common.light_close_button';
        const panel = build(bundle, 'at_common.panel', panelState);
        assert.equal(panel.nodes.filter(n => n.name === 'close' && !n.hidden && !n.p.ignored).length, Number(show),
            'The global native close visibility binding cannot re-enable an opted-out close');
    }
    assert.deepEqual(common.machine_info_tab.controls.slice(0, 2), nativeInfo.controls.slice(0, 2));
    const nativeIO = new Engine(bundle, state()).definition('uc.io_tab', 'uc');
    assert.deepEqual(new Engine(bundle, state()).definition('at_common.machine_io_tab', 'at_common').controls, nativeIO.controls);
    const helpState = state();
    helpState.controls.info_toggle_button = { '#toggle_state': true };
    helpState.variables.$info_description = Array.from({ length: 35 }, (_, i) => `Help line ${i + 1}`).join('\n');
    const help = build(bundle, 'at_common.machine_info_tab', helpState);
    const helpPanel = one(help.nodes, n => n.name === 'info_panel', 'Help panel');
    const helpFrame = one(help.nodes, n => n.name === 'info_background', 'Help background');
    assert.deepEqual(helpFrame.box, helpPanel.box, 'Frame follows the panel without inherited offsets');
    const helpLabel = one(help.nodes, n => n.name === 'description_label', 'Auto-height help text');
    assert.equal(helpLabel.p.text, helpState.variables.$info_description);
    const helpScroll = one(help.nodes, n => !!n.scroll, 'One scrolling help viewport');
    assert(helpScroll.scroll.max > 0, 'Long help remains accessible');

    for (const recipes of [false, true]) {
        const preset = state();
        // The recipe composition hides the same machine-side panel. Resolve
        // that actual top template without expanding the entire recipe book.
        preset.variables.$show_side_content = !recipes;
        const result = build(bundle, 'catalyst_weaver.catalyst_weaver_top', preset);
        const panels = result.root.children.filter(n => n.name === 'info_panel');
        assert.equal(panels.length, 1, 'Catalyst Weaver retains its information panel');
        for (const panel of panels) {
            const background = one(panel.children, n => n.name === 'background', 'Information frame background');
            const screen = one(panel.children, n => n.name === 'screen', 'Information frame inner screen');
            assert.equal(background.p.texture, 'textures/ui/panels/background_panel');
            assert.equal(screen.p.texture, 'textures/ui/panels/panel_classic_borderless');
            assert.equal(background.hidden, recipes, 'Information background follows the panel visibility');
            assert.deepEqual(background.p.size, [104, 166]);
            const scroll = one(panel.children, n => n.name === 'info_scroll', 'One scroll per information panel');
            const label = one(descendants(scroll), n => n.name === 'label_v1' && n.p.type === 'label', 'Scroll text resolves');
            assert.equal(label.collection, 'container_items');
            assert.equal(label.index, 1);
            assert.equal(label.p.text, preset.collections.container_items[1]['#hover_text']);
            assert.deepEqual(panel.p.size, [104, 166]);
            assert.equal(scroll.p.ignored, false);
            if (!panel.hidden) {
                assert(!label.hidden, 'Information text remains visible');
                const viewport = one(descendants(scroll), n => !!n.scroll, 'Native scroll viewport');
                assert(viewport.scroll.max > 0, 'Long information text overflows and can scroll');
                assert(result.engine.scrollTo(viewport, viewport.scroll.max), 'Scroll offset can reach the bottom');
            }
        }
    }

    for (const checked of [false, true]) for (const hover of [false, true]) {
        const preset = state();
        preset.controls.show_status_panel = { '#toggle_state': checked, '#hover': hover };
        const result = build(bundle, 'absolute_container.absolute_container_top', preset);
        const toggle = one(result.nodes, n => n.name === 'show_status_panel', 'Absolute Container status toggle');
        assert.equal(toggle.p.property_bag['#toggle_state'], true, 'Initially open status panel is preserved');
        assert.deepEqual(toggle.p.button_mappings.map(m => [m.from_button_id, m.to_button_id]),
            [['button.menu_select', 'button.menu_select'], ['button.menu_ok', 'button.menu_select']]);
        const variant = one(toggle.children, n => n.name === `${checked ? 'checked' : 'unchecked'}${hover ? '_hover' : ''}`, 'Native state reference');
        assert(!variant.hidden, 'Active toggle state is visible');
        const icon = one(descendants(variant), n => n.name === 'icon', 'Plus/minus identity');
        assert.equal(icon.p.texture, `textures/ui/${checked ? 'minus' : 'plus'}`);
        const focuses = descendants(variant).filter(n => n.name === 'focus' && !n.hidden && !n.p.ignored);
        assert.equal(focuses.length, Number(hover), 'Only hover/focus has a white border');
        for (const lockedName of ['unchecked_locked', 'checked_locked', 'unchecked_locked_hover', 'checked_locked_hover']) {
            const locked = one(toggle.children, n => n.name === lockedName, 'Native disabled state reference');
            assert.equal(one(descendants(locked), n => n.name === 'background', 'Disabled background').p.alpha, 0.5);
            assert.deepEqual(one(descendants(locked), n => n.name === 'icon', 'Disabled icon').p.color, [0.5, 0.5, 0.5]);
        }
    }

    const compactor = build(bundle, 'compactor.compactor_top');
    const nativeButton = new Engine(bundle, state()).definition('common.container_slot_button_prototype', 'common');
    for (const [name, start, texture] of [['input_grid', 3, 'input_1_slot'], ['output_grid', 16, 'output_1_slot']]) {
        const grid = one(compactor.nodes, n => n.name === name, name);
        assert.deepEqual(grid.children.map(n => n.index), Array.from({ length: 9 }, (_, i) => start + i));
        for (const slot of grid.children) {
            const nodes = descendants(slot);
            const outline = one(nodes, n => n.name === 'outline', 'One outline per cell');
            assert.equal(outline.p.texture, `textures/ui/slots/${texture}`);
            assert(!outline.hidden);
            const renderer = one(nodes, n => n.p.renderer === 'inventory_item_renderer' && n.parent?.name === 'item' && n.parent?.parent?.name === 'item_cell', 'Native item renderer');
            assert.equal(renderer.index, slot.index);
            const button = one(slot.children, n => n.p.type === 'button', 'Native slot actions');
            assert.deepEqual(button.raw.button_mappings, nativeButton.button_mappings);
        }
    }

    // Exercise the optional colored appearance on the real shared slot helper.
    const colored = state();
    Object.assign(colored.variables, { '$slot_texture': 'textures/ui/cells/blue_cell_image',
        '$slot_hover_texture': 'textures/ui/cells/hover_inverted_blue_cell_image', '$slot_index': 3 });
    const slot = build(bundle, 'at_common.input_slot', colored);
    assert(slot.nodes.some(n => n.p.texture === colored.variables.$slot_texture), 'Colored background');
    assert(slot.nodes.some(n => n.p.texture === colored.variables.$slot_hover_texture), 'Colored hover');
    const tooltip = one(slot.nodes, n => n.p.renderer === 'hover_text_renderer' && n.path.includes('/native/highlight/'), 'Native tooltip is retained');
    assert.equal(tooltip.index, 3);
    assert(tooltip.raw.bindings.some(b => b.binding_name === '$hover_text_binding_name' && b.binding_type === 'collection'));
    const nativeHighlight = one(slot.nodes, n => n.name === 'native', 'Complete native highlight panel');
    assert.deepEqual(nativeHighlight.raw.controls, new Engine(bundle, state()).definition('common.highlight_slot_panel', 'common').controls);
    console.log('PASS: Catalyst Weaver scroll, Absolute Container toggle states, Compactor slots/actions, colored hover/tooltip; no inherited modifications in shared controls.');
    console.log('Preview checks only. A fresh Bedrock screen load and content log remain required for in-game acceptance.');
})().catch(error => { console.error(error); process.exitCode = 1; });
