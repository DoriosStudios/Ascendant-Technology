/**
 * Predefined particle identifiers for drop effects.
 *
 * Use this map in drop configs for better consistency and autocomplete.
 * Example:
 * particles: [{ id: DROPS_PARTICLES.BASIC_SMOKE, count: 2, spread: 0.2 }]
 */
export const DROPS_PARTICLES = Object.freeze({
	// Generic impact / break
	BLOCK_BREAK: 'minecraft:block_destruct',
	BLOCK_BREAK_NO_SOUND: 'minecraft:block_destruct_no_sound',
	BLOCK_BREAK_SMOKE: 'minecraft:block_slide',
	CRITICAL_HIT: 'minecraft:critical_hit_emitter',
	ENCHANTED_HIT: 'minecraft:enchanted_hit_multiple',

	// Smoke / fire / heat
	BASIC_SMOKE: 'minecraft:basic_smoke_particle',
	LARGE_SMOKE: 'minecraft:large_smoke_particle',
	CAMPFIRE_SMOKE: 'minecraft:campfire_smoke_particle',
	REDSTONE_SMOKE: 'minecraft:redstone_ore_dust_particle',
	LAVA_SPARK: 'minecraft:lava_particle',
	FLAME: 'minecraft:basic_flame_particle',

	// Magic / arcane
	DRAGON_BREATH: 'minecraft:dragon_breath_fire',
	END_ROD: 'minecraft:endrod',
	EVOCATION: 'minecraft:evocation_fang_particle',
	TOTEM: 'minecraft:totem_particle',

	// Nature / growth
	CROP_GROWTH: 'minecraft:crop_growth_emitter',
	HAPPY_VILLAGER: 'minecraft:villager_happy',
	BONE_MEAL: 'minecraft:crop_growth_area_emitter',
	SPORE_BLOSSOM: 'minecraft:spore_blossom_shower_particle',

	// Water / frost
	SPLASH: 'minecraft:water_splash_particle',
	BUBBLE: 'minecraft:water_evaporation_bucket_emitter',
	RAIN_SPLASH: 'minecraft:rain_splash_particle',
	SNOWFLAKE: 'minecraft:basic_snowflake_particle',
	SNOWBALL_POOF: 'minecraft:snowballpoof',

	// Dust / ore / material
	REDSTONE_DUST: 'minecraft:redstone_repeater_dust_particle',
	WAX_ON: 'minecraft:wax_particle',
	WAX_OFF: 'minecraft:wax_off_particle',

	// Portal / teleport
	PORTAL: 'minecraft:portal_east_west',
	REVERSE_PORTAL: 'minecraft:reverse_portal',
	MOB_PORTAL: 'minecraft:mob_portal',

	// Combat-ish
	EXPLOSION: 'minecraft:large_explosion',
	SMALL_EXPLOSION: 'minecraft:large_explosion',
	KNOCKBACK_ROAR: 'minecraft:knockback_roar_particle'
});

/**
 * Convenience helper for configs that prefer function-style access.
 * @param {keyof typeof DROPS_PARTICLES} key
 * @returns {string}
 */
export function particle(key) {
	return DROPS_PARTICLES[key] ?? '';
}
