
/** 
 * @global
 * @typedef {import("@minecraft/server").ItemStack} ItemStack
 * @typedef {import("@minecraft/server").Container} Container
 * @typedef {import("@minecraft/server").Block} Block
 * @typedef {import("@minecraft/server").Entity} Entity
 * @typedef {import("@minecraft/server").Player} Player
 * @typedef {import("@minecraft/server").EntityTypeFamilyComponent} EntityTypeFamilyComponent
 * @typedef {import("@minecraft/server").ScoreboardObjective} ScoreboardObjective
 * @typedef {import("@minecraft/server").Vector3} Vector3
 * @typedef {import("@minecraft/server").Dimension} Dimension
 * @typedef {import("@minecraft/server").BlockPermutation} BlockPermutation
 * @typedef {import("@minecraft/server").BlockCustomComponent} BlockCustomComponent
 * @typedef {import("@minecraft/server").ItemCustomComponent} ItemCustomComponent
 * @typedef {import("@minecraft/server").BlockComponentTickEvent} BlockComponentTickEvent
 * @typedef {import("@minecraft/server").BlockComponentPlayerPlaceBeforeEvent} BlockComponentPlayerPlaceBeforeEvent
 */

/**
 * Machine settings object for configuring behavior.
 * 
 * @global
 * @typedef {Object} MachineSettings
 * 
 * @property {string} rotation Block rotation type.
 * 
 * @property {Object} entity Entity configuration of the machine.
 * @property {string} entity.name Internal machine name (e.g., "crusher").
 * @property {string} entity.input_type Type of input (e.g., "simple").
 * @property {string} entity.output_type Type of output (e.g., "complex").
 * @property {number} entity.inventory_size Number of inventory slots.
 * 
 * @property {Object} machine Machine operational settings.
 * @property {number} machine.energy_cap Maximum internal energy capacity.
 * @property {number} machine.energy_cost Energy consumed per operation.
 * @property {number} generator.fluidCap Maximum internal fluid capacity.
 * @property {number} machine.rate_speed_base Base processing rate (DE/t).
 * @property {number} [machine.fixed_rate] Optional fixed energy rate (DE per second). When set, the per-update cost scales with tick speed and ignores rate_speed_base.
 * @property {boolean} [machine.dynamic_rate] When true, derives the machine rate from recipe time fields (seconds/ticks) to make configured durations accurate.
 * @property {number[]} machine.upgrades List of accepted upgrade IDs.
 * @property {EnchantmentStationSettings} [machine.station] Optional nested setup for enchantment-station tuning.
 */

/**
 * Enchantment station nested machine settings.
 *
 * @global
 * @typedef {Object} EnchantmentStationSettings
 * @property {EnchantmentStationSlotsSettings} [slots] Slot index map for the station inventory UI/layout.
 * @property {EnchantmentStationTimeSettings} [time] Time controls for dynamic-rate calculations.
 * @property {EnchantmentStationEnergySettings} [energy] Energy and inflation controls.
 * @property {EnchantmentStationModulesSettings} [modules] Module identifiers and enchant-target mappings.
 * @property {EnchantmentStationReinforcementSettings} [reinforcement] Reinforcement lore/property behavior.
 * @property {EnchantmentStationEnchantSettings} [enchant] Enchant plan/signature properties and source pools.
 * @property {EnchantmentStationCurseSettings} [curse] Curse candidate list and chance model.
 * @property {EnchantmentStationXpSettings} [xp] XP tank and per-enchant XP controls.
 * @property {EnchantmentStationDisenchantSettings} [disenchant] Disenchant catalyst controls.
 * @property {EnchantmentStationProgressSettings} [progress] Render controls for progress indicators.
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationSlotsSettings
 * @property {number} [energy]
 * @property {number} [status]
 * @property {number} [progress]
 * @property {number[]} [upgrades]
 * @property {number[]} [grid]
 * @property {number[]} [modules]
 * @property {EnchantmentStationDisenchantSlotsSettings} [disenchant]
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationDisenchantSlotsSettings
 * @property {number} [source]
 * @property {number} [catalyst]
 * @property {number} [books]
 * @property {number} [progress]
 * @property {number[]} [outputs]
 * @property {number} [status]
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationTimeSettings
 * @property {number} [full_time] Global multiplier applied to computed operation time.
 * @property {number} [enchant_seconds_per_change] Base seconds per enchant change.
 * @property {number} [repair_seconds] Base seconds per repair step.
 * @property {number} [reinforcement_seconds] Base seconds per reinforcement step.
 * @property {number} [min_process_seconds] Lower bound for operation duration in seconds.
 * @property {number} [ticks_per_second] Tick-rate basis used when converting seconds to per-tick rates.
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationEnergySettings
 * @property {number} [base_cost] Base cost unit for station operations.
 * @property {number} [enchant_operation_cost] Additional cost per enchant operation before inflation.
 * @property {EnchantmentStationEnergyRepairSettings} [repair] Repair scaling parameters.
 * @property {EnchantmentStationEnergyInflationSettings} [inflation] Cost inflation multipliers by category.
 * @property {EnchantmentStationEnergyLimitsSettings} [limits] Numeric safety limits for normalized costs.
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationEnergyRepairSettings
 * @property {number} [induction_anvil_divisor] Divisor used to convert base cost into repair amount.
 * @property {number} [multiplier] Final multiplier applied to the repair amount.
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationEnergyInflationSettings
 * @property {number} [base] Inflation multiplier for base operation cost.
 * @property {number} [enchantability_module_per_level] Inflation per enchantability module level.
 * @property {number} [enchant_change] Inflation per enchantment change.
 * @property {number} [reinforcement_module_per_level] Inflation per reinforcement module level.
 * @property {number} [curse_protection_module_per_level] Inflation per curse protection module level.
 * @property {number} [disenchant_per_enchant] Inflation per extracted enchantment during disenchant.
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationEnergyLimitsSettings
 * @property {number} [min_cost] Minimum normalized energy cost accepted by the station.
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationProgressSettings
 * @property {string} [type] Progress indicator style prefix.
 * @property {string|null} [color] Optional color suffix for progress indicators.
 * @property {number} [frame_count] Number of frames available in the progress indicator sequence.
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationModulesSettings
 * @property {EnchantmentStationModuleIdsSettings} [ids] Module item identifiers.
 * @property {EnchantmentStationEnchantTargetsSettings} [enchant_targets] Lookup tables for module-tier target enchant levels.
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationModuleIdsSettings
 * @property {string} [base]
 * @property {(string|null)[]} [enchantability]
 * @property {(string|null)[]} [reinforcement]
 * @property {string[]} [curseProtection]
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationEnchantTargetsSettings
 * @property {number[]} [levels]
 * @property {number[]} [modules]
 * @property {number[][]} [matrix]
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationReinforcementSettings
 * @property {number[]} [RATIOS]
 * @property {string} [PROP]
 * @property {RegExp|string} [LORE_PATTERN]
 * @property {string} [LORE_PREFIX]
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationEnchantSettings
 * @property {string} [signature_prop]
 * @property {string} [plan_prop]
 * @property {Array<{ kind?: string, entries?: string[], weight?: number }>} [sources]
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationCurseSettings
 * @property {string[]} [enchant_ids]
 * @property {number} [chance_base]
 * @property {number} [chance_per_enchant]
 * @property {number} [protection_modifier]
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationXpSettings
 * @property {string} [tank_type]
 * @property {number} [tank_cap_default]
 * @property {number} [per_enchant]
 */

/**
 * @global
 * @typedef {Object} EnchantmentStationDisenchantSettings
 * @property {string[]} [catalyst_ids]
 */

/**
 * Generator settings object for configuring behavior.
 * 
 * @global
 * @typedef {Object} GeneratorSettings
 * @property {Object} entity Entity configuration of the generator.
 * @property {string} entity.name Internal generator name (e.g., "furnator").
 * @property {string} entity.type Type of generator (e.g., "simple").
 * @property {number} entity.inventory_size Number of inventory slots.
 * 
 * @property {Object} generator Generator operational settings.
 * @property {number} generator.energy_cap Maximum internal energy capacity.
 * @property {number} generator.fluidCap Maximum internal fluid capacity.
 * @property {number} generator.rate_speed_base Base processing rate (DE/t).
 */


/**
 * @global
 * @typedef {"energy" | "filter" | "quantity" | "range" | "speed" | "ultimate" | "size" | "hyper"} UpgradeType
 */

/**
 * Object mapping upgrade levels by type.
 * Keys are autocompleted from UpgradeType.
 *
 * @global
 * @typedef {Object} UpgradeLevels
 * @property {number} energy
 * @property {number} range
 * @property {number} speed
 * @property {number} size
 * @property {number} ultimate
 * @property {number} hyper
 */

/**
 * Parameters stored in a sieve mesh item.
 *
 * @global
 * @typedef {Object} MeshParams
 * @property {number} tier       The mesh tier level (e.g., 0, 1, 2...).
 * @property {number} multiplier Loot multiplier applied to sieve results.
 * @property {number} amount_multiplier Loot multiplier applied to sieve results.
 */

/**
 * Represents a single input→output recipe (Press, Furnace, Crusher, etc.).
 *
 * @global
 * @typedef {Object} SingleInputRecipe
 * @property {string} output The resulting item identifier.
 * @property {number} [required=1] Number of input items required per operation (defaults to 1).
 * @property {number} [amount=1] Number of output items produced (defaults to 1).
 * @property {number} [cost=800] Energy cost to process the item (defaults to 800).
 */

/**
 * Represents a collection of single-input recipes.
 *
 * The keys are input item identifiers, and each value describes
 * the resulting output and requirements.
 *
 * @global
 * @typedef {Object.<string, SingleInputRecipe>} SingleInputRecipes
 */

/**
 * Represents a single infusing recipe entry.
 *
 * @global
 * @typedef {Object} InfusingRecipe
 * @property {string} output The resulting item identifier.
 * @property {number} [required=1] Number of catalyst items required (defaults to 1).
 * @property {number} [amount=1] Number of output items produced (defaults to 1).
 */

/**
 * Represents all infusing recipes in a flat format (catalyst|input).
 *
 * Key format: "catalyst|input"
 *
 * @global
 * @typedef {Object.<string, InfusingRecipe>} InfuserRecipes
 */

/**
 * @global
 * @typedef {Object} SoilData
 * @property {number} cost Energy cost multiplier for growth.
 * @property {number} multi Loot multiplier (max 4).
 */

/**
 * @global
* @typedef {Object} CropDrop
* @property {string} item Item identifier.
* @property {number} min Minimum quantity dropped.
* @property {number} max Maximum quantity dropped.
* @property {number} chance Probability percentage (0–100).
*/

/**
 * @global
 * @typedef {Object} CropData
 * @property {number} cost Energy cost to grow the crop.
 * @property {CropDrop[]} drops List of possible drops from the crop.
 */
