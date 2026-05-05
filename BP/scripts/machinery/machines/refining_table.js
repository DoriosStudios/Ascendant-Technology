import { system } from '@minecraft/server'
import {
    FluidManager,
    Machine,
    buildOverclockLoreLine,
    formatItemName,
} from '../../DoriosCore/main.js'
import {
    getStatsCoreDefinition,
    ITEM_TYPES,
    readStatsState,
    writeStatsState,
} from '../../StatsCore/main.js'
import { collectStatsAbilityNames } from '../../StatsCore/core/abilities.js'
import { resolveStatsAttributes } from '../../StatsCore/attributes/resolve.js'
import { normalizeId, safeJsonParse, titleCaseIdentifier } from '../../StatsCore/utils.js'
import {
    formatEnergyCost,
    formatFluidTankBuffer,
    formatMachineEnergyBuffer,
    formatPercentFromRatio,
    shouldRefreshSuperiorUi,
    syncSuperiorButtonPanel,
} from './superior/utils.js'

const REFINING_TABLE = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        equipment: 3,
        ingot: 4,
        chip: 5,
        confirmButton: 6,
        chances: 7,
        totem: 8,
        upgrades: Object.freeze([9, 10, 11]),
    }),
    props: Object.freeze({
        queuedTick: 'utilitycraft:refining_table_queued_tick',
        activeSignature: 'utilitycraft:refining_table_active_signature',
        pendingRefinement: 'utilitycraft:refining_table_pending_refinement',
    }),
    defaults: Object.freeze({
        idleEnergyCost: 7200,
        xpTankCapacity: 512000,
        xpFluidType: 'xp',
        unlockCatalystId: 'utilitycraft:runic_core',
        maxIngotsPerRoll: 8,
        strongThreshold: 0.55,
        masterworkThreshold: 0.78,
        transcendentThreshold: 0.92,
        minRollSpread: 0.04,
    }),
    chips: Object.freeze({
        'utilitycraft:chip': Object.freeze({
            id: 'utilitycraft:chip',
            label: 'Chip',
            minQuality: 0.08,
            maxQuality: 0.38,
            baseXpCost: 80,
            baseEnergyCost: 5200,
        }),
        'utilitycraft:basic_chip': Object.freeze({
            id: 'utilitycraft:basic_chip',
            label: 'Basic Chip',
            minQuality: 0.18,
            maxQuality: 0.48,
            baseXpCost: 120,
            baseEnergyCost: 7600,
        }),
        'utilitycraft:advanced_chip': Object.freeze({
            id: 'utilitycraft:advanced_chip',
            label: 'Advanced Chip',
            minQuality: 0.30,
            maxQuality: 0.62,
            baseXpCost: 180,
            baseEnergyCost: 10800,
        }),
        'utilitycraft:expert_chip': Object.freeze({
            id: 'utilitycraft:expert_chip',
            label: 'Expert Chip',
            minQuality: 0.42,
            maxQuality: 0.74,
            baseXpCost: 260,
            baseEnergyCost: 15400,
        }),
        'utilitycraft:ultimate_chip': Object.freeze({
            id: 'utilitycraft:ultimate_chip',
            label: 'Ultimate Chip',
            minQuality: 0.54,
            maxQuality: 0.84,
            baseXpCost: 360,
            baseEnergyCost: 21200,
        }),
        'utilitycraft:superior_chip': Object.freeze({
            id: 'utilitycraft:superior_chip',
            label: 'Superior Chip',
            minQuality: 0.66,
            maxQuality: 0.92,
            baseXpCost: 500,
            baseEnergyCost: 28600,
        }),
        'utilitycraft:absolute_chip': Object.freeze({
            id: 'utilitycraft:absolute_chip',
            label: 'Absolute Chip',
            minQuality: 0.76,
            maxQuality: 0.98,
            baseXpCost: 680,
            baseEnergyCost: 36800,
        }),
    }),
    ingots: Object.freeze({
        'minecraft:copper_ingot': Object.freeze({ id: 'minecraft:copper_ingot', label: 'Copper Ingot', power: 0.35 }),
        'minecraft:iron_ingot': Object.freeze({ id: 'minecraft:iron_ingot', label: 'Iron Ingot', power: 0.50 }),
        'minecraft:gold_ingot': Object.freeze({ id: 'minecraft:gold_ingot', label: 'Gold Ingot', power: 0.60 }),
        'utilitycraft:steel_ingot': Object.freeze({ id: 'utilitycraft:steel_ingot', label: 'Steel Ingot', power: 0.72 }),
        'utilitycraft:energized_iron_ingot': Object.freeze({ id: 'utilitycraft:energized_iron_ingot', label: 'Energized Iron Ingot', power: 0.82 }),
        'utilitycraft:titanium': Object.freeze({ id: 'utilitycraft:titanium', label: 'Titanium Ingot', power: 1.00 }),
        'minecraft:netherite_ingot': Object.freeze({ id: 'minecraft:netherite_ingot', label: 'Netherite Ingot', power: 1.16 }),
        'utilitycraft:aetherium': Object.freeze({ id: 'utilitycraft:aetherium', label: 'Aetherium Ingot', power: 1.30 }),
    }),
    templates: Object.freeze({
        [ITEM_TYPES.weapon]: Object.freeze({
            damageMultiplier: 0.10,
            critChance: 0.05,
            critMultiplier: 0.24,
            penetration: 0.06,
            lifesteal: 0.018,
        }),
        [ITEM_TYPES.tool]: Object.freeze({
            bonusDropChance: 0.08,
            oreBonusChance: 0.10,
            durabilitySaveChance: 0.08,
        }),
        [ITEM_TYPES.hybrid]: Object.freeze({
            damageMultiplier: 0.08,
            critChance: 0.035,
            critMultiplier: 0.16,
            penetration: 0.04,
            lifesteal: 0.012,
            bonusDropChance: 0.05,
            oreBonusChance: 0.06,
            durabilitySaveChance: 0.05,
        }),
        [ITEM_TYPES.support]: Object.freeze({
            damageReduction: 0.032,
            durabilityPreserveChance: 0.08,
            negateAllDamageChance: 0.03,
        }),
    }),
    tierScales: Object.freeze({
        wood: 0.54,
        stone: 0.62,
        iron: 0.74,
        golden: 0.7,
        diamond: 0.84,
        netherite: 0.94,
        titanium: 0.95,
        aetherium: 1.05,
        lucky: 1.14,
    }),
})

const SPECIAL_ABILITY_DESCRIPTIONS = Object.freeze({
    bleeding: 'Bleed ticks now spray red dust from the victim while the effect damages them.',
    sweeping: 'Exclusive to AIOTs, releasing wide strikes that hit nearby enemies.',
    luck: 'Breaking ores always creates an XP orb.',
    crushing: 'Hammer ore breaks always add matching dust for coal, copper, iron, gold, and titanium.',
    operator: 'Sneak + interact cycles Crushy, Silky, and Greedy drill modes.',
    gardener: 'Breaking leaves or plants clears a flat 5x5 area and duplicates plant harvests.',
    primal: 'Boosts fiber, stick, and cane drops while adding bleed and +4 Attack Damage.',
    forger: 'Ore breaks can add matching plates, netherrack yields 4 nether bricks, and hits ignite enemies.',
    ingniter: 'Igniting TNT replaces it with a fresh TNT block and can light Creepers.',
    skewer: 'Hits can mark targets so follow-up damage lands harder.',
    aftershock: 'Shockwaves launch nearby mobs with Levitation V for 2 seconds, then Slowness IV for 5 seconds.',
    harpoon: 'Marks targets and, with Loyalty, launches the user forward with brief fall protection.',
    deadeye: 'Bow hits attempt to calm the struck mob using its calm event.',
    ballista: 'Marked bolts chain into up to 3 extra nearby targets.',
    reaper: 'Hoes gain +2 Attack Damage, cleave similar mobs, and ripe crops are doubled then replanted.',
    worm: 'Shovels cycle soil variants, dig up buried seeds while sneaking, drop handfuls/fragments, and grant 50% evade while held.',
    berserk: 'Axes gain stacking kill damage and can turn sneaking log breaks into bonus planks.',
    clarity: 'Grants Night Vision below Y48 in the Overworld.',
    retaliation: 'Taking damage can reflect part of it back at the attacker.',
    bulwark: 'Legging passive focused on steady protection and survival.',
    featherstep: 'Cuts fall damage by 80% and grants short Absorption with a 1-minute cooldown.',
    spikes: 'Reflects incoming damage, knocks attackers back, and pulls nearby monsters toward them.',
    tough: 'Turtle Helmet grants Conduit Power in water and reduces falling block, suffocation, lightning, and stalactite damage.',
})

const REFINING_TABLE_BUTTONS = Object.freeze({
    id: 'refining_table_controls',
    namespace: 'ascendant:refining_table',
    cooldownTicks: 8,
    defaultIconItemId: 'utilitycraft:switch_button',
    buttons: Object.freeze([
        Object.freeze({
            id: 'confirm_refine',
            slot: REFINING_TABLE.slots.confirmButton,
            type: 'action',
            getTitle: ({ machine }) => isOperationActive(machine) ? 'Refining...' : 'Confirm Refine',
            getLore: ({ machine }) => buildConfirmButtonLore(buildRefiningPreview(machine)),
            isEnabled: ({ machine }) => {
                if (isOperationActive(machine)) return false
                return buildRefiningPreview(machine).ready === true
            },
            pressHint: 'Take the switch to confirm the refinement.',
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onPress: ({ machine }) => {
                if (!machine?.entity || isOperationActive(machine)) return false

                const preview = buildRefiningPreview(machine)
                if (!preview.ready) return false

                queueRefining(machine, preview)
                return true
            },
        }),
    ]),
})

DoriosAPI.register.blockComponent('refining_table', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            ensureRefiningXpTank(machine, settings)
            machine.setEnergyCost(settings?.machine?.energy_cost ?? REFINING_TABLE.defaults.idleEnergyCost)
            machine.displayEnergy(REFINING_TABLE.slots.energy)
            machine.displayProgress(REFINING_TABLE.slots.progress)
            syncSuperiorButtonPanel(machine, REFINING_TABLE_BUTTONS, {
                detectPresses: false,
                forceRender: true,
            })
            machine.setLabel(buildEquipmentLabel(null), REFINING_TABLE.slots.chances)
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid || !machine.entity || !machine.inv) return

        ensureRefiningXpTank(machine, settings)

        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, 'refining_table:ui')
        syncSuperiorButtonPanel(machine, REFINING_TABLE_BUTTONS, {
            forceRender: shouldRefreshUi,
        })

        const tracked = syncTrackedEquipment(machine)
        const preview = buildRefiningPreview(machine, tracked)
        const activeSignature = getActiveSignature(machine)

        machine.setEnergyCost(preview.energyCost ?? REFINING_TABLE.defaults.idleEnergyCost)

        if (activeSignature) {
            if (!preview.valid || preview.signature !== activeSignature) {
                cancelRefining(machine)
                showMachineWarning(machine, 'Inputs Changed', preview, true)
                renderChanceDisplay(machine, preview, true)
                return
            }

            if (machine.energy.get() <= 0) {
                showMachineWarning(machine, 'No Energy', preview, false, shouldRefreshUi)
                renderChanceDisplay(machine, preview, shouldRefreshUi)
                return
            }

            if (preview.availableXp < preview.xpCost) {
                showMachineWarning(machine, 'Need XP', preview, false, shouldRefreshUi)
                renderChanceDisplay(machine, preview, shouldRefreshUi)
                return
            }

            const progress = machine.getProgress()
            if (progress >= preview.energyCost) {
                const result = applyRefinement(machine, preview)
                if (!result.success) {
                    cancelRefining(machine)
                    showMachineWarning(machine, result.message ?? 'Refine Failed', preview, true)
                    renderChanceDisplay(machine, preview, true)
                    return
                }

                clearQueuedRefining(machine)
                clearActiveSignature(machine)
                machine.setProgress(0, REFINING_TABLE.slots.progress)
                showMachineStatus(machine, 'Refined', result.preview ?? preview, true, result.refinement)
                renderChanceDisplay(machine, result.preview ?? preview, true)
                return
            }

            consumeRefiningEnergy(machine, preview)
            showMachineStatus(machine, 'Refining', preview, shouldRefreshUi)
            renderChanceDisplay(machine, preview, shouldRefreshUi)
            return
        }

        if (isRefiningQueued(machine)) {
            clearQueuedRefining(machine)
            if (!preview.ready) {
                clearPendingRefinement(machine)
                showMachineWarning(machine, preview.problem ?? 'Not Ready', preview, true)
                renderChanceDisplay(machine, preview, true)
                return
            }

            setActiveSignature(machine, preview.signature)
            machine.setProgress(0, REFINING_TABLE.slots.progress)
            showMachineStatus(machine, 'Queued', preview, true)
            renderChanceDisplay(machine, preview, true)
            return
        }

        if (!preview.valid) {
            showMachineWarning(machine, preview.problem ?? 'Insert Equipment', preview, true, shouldRefreshUi)
            renderChanceDisplay(machine, preview, shouldRefreshUi)
            return
        }

        if (!preview.ready) {
            showMachineWarning(machine, preview.problem ?? 'Not Ready', preview, true, shouldRefreshUi)
            renderChanceDisplay(machine, preview, shouldRefreshUi)
            return
        }

        showMachineStatus(machine, 'Ready', preview, shouldRefreshUi)
        renderChanceDisplay(machine, preview, shouldRefreshUi)
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    },
})

function getRefiningXpTank(machine) {
    if (!machine?.entity) return null

    try {
        const tank = FluidManager.initializeSingle(machine.entity)
        if (tank.getCap() <= 0) {
            tank.setCap(REFINING_TABLE.defaults.xpTankCapacity)
        }
        if (tank.getType() === 'empty') {
            tank.setType(REFINING_TABLE.defaults.xpFluidType)
        }
        return tank
    } catch {
        return null
    }
}

function ensureRefiningXpTank(machine, settings) {
    const tank = getRefiningXpTank(machine)
    if (!tank) return null

    const configuredCap = Number(settings?.machine?.fluid_cap ?? REFINING_TABLE.defaults.xpTankCapacity)
    if (Number.isFinite(configuredCap) && configuredCap > 0 && tank.getCap() !== configuredCap) {
        tank.setCap(configuredCap)
    }

    if (tank.getType() !== REFINING_TABLE.defaults.xpFluidType && tank.get() <= 0) {
        tank.setType(REFINING_TABLE.defaults.xpFluidType)
    }

    try {
        machine.entity.setDynamicProperty('dorios:fluid_whitelist', REFINING_TABLE.defaults.xpFluidType)
    } catch { }

    return tank
}

function getXpTankAmount(tank) {
    return Math.max(0, Number(tank?.get?.() ?? 0) || 0)
}

function setPendingRefinement(machine, refinement) {
    const serialized = refinement ? JSON.stringify(refinement) : undefined
    machine?.entity?.setDynamicProperty?.(REFINING_TABLE.props.pendingRefinement, serialized)
}

function readPendingRefinement(machine) {
    const raw = String(machine?.entity?.getDynamicProperty?.(REFINING_TABLE.props.pendingRefinement) ?? '')
    if (!raw) return null
    const parsed = safeJsonParse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
}

function clearPendingRefinement(machine) {
    setPendingRefinement(machine, undefined)
}

function getChipConfig(typeId) {
    return REFINING_TABLE.chips[normalizeId(typeId)] ?? null
}

function getIngotConfig(typeId) {
    return REFINING_TABLE.ingots[normalizeId(typeId)] ?? null
}

function getTierScale(definition) {
    return REFINING_TABLE.tierScales[normalizeId(definition?.tier)] ?? 1
}

function getTemplate(definition) {
    return REFINING_TABLE.templates[definition?.type] ?? null
}

function buildDefinitionAbilityAttributes(definition) {
    return {
        effects: Array.isArray(definition?.attributes?.effects) ? definition.attributes.effects : [],
        mining: {
            effects: Array.isArray(definition?.mining?.effects) ? definition.mining.effects : [],
        },
        support: {
            effects: Array.isArray(definition?.support?.effects) ? definition.support.effects : [],
        },
    }
}

function buildDefinitionAbilityNames(definition, state) {
    if (!definition) return []
    return collectStatsAbilityNames(buildDefinitionAbilityAttributes(definition), { state })
}

function hasTotemAbilityLock(definition, state, abilityNames = buildDefinitionAbilityNames(definition, state)) {
    if (!definition || abilityNames.length <= 0) return false
    if (normalizeId(definition?.uniqueAbilityUnlock) !== 'totem') return false
    return state?.abilityData?.uniqueUnlocked !== true
}

function getActiveSignature(machine) {
    return String(machine?.entity?.getDynamicProperty(REFINING_TABLE.props.activeSignature) ?? '')
}

function setActiveSignature(machine, signature) {
    machine?.entity?.setDynamicProperty?.(REFINING_TABLE.props.activeSignature, signature || undefined)
}

function clearActiveSignature(machine) {
    setActiveSignature(machine, undefined)
}

function isOperationActive(machine) {
    return getActiveSignature(machine).length > 0
}

function queueRefining(machine, preview = buildRefiningPreview(machine)) {
    if (preview?.ready) {
        setPendingRefinement(machine, buildRolledRefinement(preview))
    }
    machine?.entity?.setDynamicProperty?.(REFINING_TABLE.props.queuedTick, Number(system.currentTick ?? 0) || 1)
}

function clearQueuedRefining(machine) {
    machine?.entity?.setDynamicProperty?.(REFINING_TABLE.props.queuedTick, undefined)
}

function isRefiningQueued(machine) {
    return Number(machine?.entity?.getDynamicProperty?.(REFINING_TABLE.props.queuedTick) ?? 0) > 0
}

function cancelRefining(machine) {
    clearQueuedRefining(machine)
    clearActiveSignature(machine)
    clearPendingRefinement(machine)
    machine?.setProgress?.(0, REFINING_TABLE.slots.progress)
}

function syncTrackedEquipment(machine) {
    const stack = machine?.inv?.getItem?.(REFINING_TABLE.slots.equipment)
    if (!stack?.typeId) return null

    const definition = getStatsCoreDefinition(stack.typeId)
    if (!definition) {
        return {
            stack,
            definition: null,
            state: null,
        }
    }

    const state = readStatsState(stack, definition)

    return {
        stack,
        definition,
        state,
    }
}

function buildRefiningPreview(machine, tracked = syncTrackedEquipment(machine)) {
    const equipment = tracked?.stack ?? machine?.inv?.getItem?.(REFINING_TABLE.slots.equipment) ?? null
    const definition = tracked?.definition ?? (equipment?.typeId ? getStatsCoreDefinition(equipment.typeId) : null)
    const state = tracked?.state ?? (equipment && definition ? readStatsState(equipment, definition) : null)
    const attributes = definition && state ? resolveStatsAttributes(definition, state) : null
    const chipStack = machine?.inv?.getItem?.(REFINING_TABLE.slots.chip) ?? null
    const chipConfig = getChipConfig(chipStack?.typeId)
    const ingotStack = machine?.inv?.getItem?.(REFINING_TABLE.slots.ingot) ?? null
    const ingotConfig = ingotStack ? getIngotConfig(ingotStack.typeId) : null
    const totemStack = machine?.inv?.getItem?.(REFINING_TABLE.slots.totem) ?? null
    const xpTank = getRefiningXpTank(machine)
    const availableXp = getXpTankAmount(xpTank)
    const template = getTemplate(definition)
    const typeSupported = !!definition && !!template
    const potentialAbilityNames = buildDefinitionAbilityNames(definition, state)
    const abilityUnlocked = !definition || !hasTotemAbilityLock(definition, { ...state, abilityData: { ...state?.abilityData, uniqueUnlocked: true } }, potentialAbilityNames)
    const requiresTotem = hasTotemAbilityLock(definition, state, potentialAbilityNames)
    const totemPresent = normalizeId(totemStack?.typeId) === normalizeId(REFINING_TABLE.defaults.unlockCatalystId)
    const effectiveIngots = ingotConfig
        ? Math.min(REFINING_TABLE.defaults.maxIngotsPerRoll, Math.max(0, Number(ingotStack?.amount ?? 0)))
        : 0
    const rerolls = Math.max(0, Number(state?.refinement?.rerolls ?? 0))

    const preview = {
        valid: false,
        ready: false,
        equipment,
        definition,
        state,
        attributes,
        xpTank,
        availableXp,
        chipStack,
        chipConfig,
        ingotStack,
        ingotConfig,
        totemStack,
        totemPresent,
        abilityUnlocked,
        requiresTotem,
        potentialAbilityNames,
        effectiveIngots,
        rerolls,
        energyCost: REFINING_TABLE.defaults.idleEnergyCost,
        xpCost: 0,
        range: { min: 0, max: 0 },
        odds: { strong: 0, masterwork: 0, transcendent: 0 },
        signature: '',
        problem: 'Insert Equipment',
    }

    if (!equipment?.typeId) {
        return preview
    }

    if (!definition) {
        return {
            ...preview,
            valid: false,
            problem: 'Unsupported Item',
        }
    }

    if (!typeSupported) {
        return {
            ...preview,
            valid: false,
            problem: 'Unsupported Profile',
        }
    }

    if (ingotStack?.typeId && !ingotConfig) {
        return {
            ...preview,
            valid: true,
            problem: 'Unsupported Ingot',
        }
    }

    if (!chipConfig) {
        return {
            ...preview,
            valid: true,
            problem: 'Insert Chip',
        }
    }

    const range = computeRollRange(chipConfig, ingotConfig, effectiveIngots)
    const costs = computeOperationCosts(chipConfig, ingotConfig, effectiveIngots, rerolls)
    const odds = {
        strong: chanceAtOrAbove(range, REFINING_TABLE.defaults.strongThreshold),
        masterwork: chanceAtOrAbove(range, REFINING_TABLE.defaults.masterworkThreshold),
        transcendent: chanceAtOrAbove(range, REFINING_TABLE.defaults.transcendentThreshold),
    }
    const signature = [
        state?.uid || equipment.typeId,
        state?.xp ?? 0,
        state?.refinement?.spentXp ?? 0,
        state?.refinement?.rerolls ?? 0,
        state?.abilityData?.uniqueUnlocked === true ? 1 : 0,
        state?.abilityData?.operatorMode ?? 'crushy',
        chipConfig.id,
        ingotConfig?.id ?? '',
        effectiveIngots,
        totemStack?.typeId ?? '',
        totemStack?.amount ?? 0,
    ].join('|')

    const nextPreview = {
        ...preview,
        valid: true,
        chipConfig,
        ingotConfig,
        effectiveIngots,
        availableXp,
        energyCost: costs.energyCost,
        xpCost: costs.xpCost,
        range,
        odds,
        signature,
        problem: requiresTotem && !totemPresent
            ? 'Insert Runic Core'
            : (availableXp >= costs.xpCost ? null : 'Need More XP'),
    }

    return {
        ...nextPreview,
        ready: availableXp >= costs.xpCost && (!requiresTotem || totemPresent),
    }
}

function computeRollRange(chipConfig, ingotConfig, ingotAmount) {
    if (!chipConfig) {
        return { min: 0, max: 0 }
    }

    const power = Number(ingotConfig?.power ?? 0)
    const count = Math.max(0, Number(ingotAmount ?? 0))
    const min = Math.min(0.98, chipConfig.minQuality + (count * 0.012 * power))
    const max = Math.min(0.99, Math.max(min + REFINING_TABLE.defaults.minRollSpread, chipConfig.maxQuality + (count * 0.018 * power)))
    return { min, max }
}

function computeOperationCosts(chipConfig, ingotConfig, ingotAmount, rerolls = 0) {
    const count = Math.max(0, Number(ingotAmount ?? 0))
    const power = Number(ingotConfig?.power ?? 0)
    const rerollScalar = 1 + Math.min(1.8, Math.max(0, Number(rerolls ?? 0)) * 0.18)

    return {
        xpCost: Math.max(1, Math.floor((chipConfig.baseXpCost + (count * 20 * power)) * rerollScalar)),
        energyCost: Math.max(1, Math.floor((chipConfig.baseEnergyCost + (count * 960 * power)) * rerollScalar)),
    }
}

function chanceAtOrAbove(range, threshold) {
    const min = Number(range?.min ?? 0)
    const max = Number(range?.max ?? 0)
    if (max <= threshold) return 0
    if (min >= threshold) return 1
    if (max <= min) return 0
    return Math.max(0, Math.min(1, (max - threshold) / (max - min)))
}

function rollQuality(range) {
    const min = Number(range?.min ?? 0)
    const max = Number(range?.max ?? 0)
    if (max <= min) return min
    return min + (Math.random() * (max - min))
}

function getGradeFromQuality(quality) {
    if (quality >= REFINING_TABLE.defaults.transcendentThreshold) return 'transcendent'
    if (quality >= REFINING_TABLE.defaults.masterworkThreshold) return 'masterwork'
    if (quality >= REFINING_TABLE.defaults.strongThreshold) return 'exceptional'
    if (quality >= 0.32) return 'steady'
    return 'rough'
}

function roundBonus(value) {
    return Math.round(Number(value || 0) * 10000) / 10000
}

function buildRolledRefinement(preview) {
    const quality = rollQuality(preview.range)
    const grade = getGradeFromQuality(quality)
    const template = getTemplate(preview.definition)
    const tierScale = getTierScale(preview.definition)
    const bonuses = {}

    for (const [key, maxValue] of Object.entries(template ?? {})) {
        const variance = 0.92 + (Math.random() * 0.16)
        bonuses[key] = roundBonus(Math.min(0.99, Number(maxValue) * quality * tierScale * variance))
    }

    return {
        version: 1,
        grade,
        quality: roundBonus(quality),
        minQuality: roundBonus(preview.range.min),
        maxQuality: roundBonus(preview.range.max),
        spentXp: Math.max(0, Number(preview.state?.refinement?.spentXp ?? 0)) + preview.xpCost,
        rerolls: Math.max(0, Number(preview.state?.refinement?.rerolls ?? 0)) + 1,
        chipId: preview.chipConfig?.id ?? '',
        chipLabel: preview.chipConfig?.label ?? 'Chip',
        ingotId: preview.ingotConfig?.id ?? '',
        ingotAmount: preview.effectiveIngots,
        bonuses,
    }
}

function applyRefinement(machine, preview) {
    const stack = machine?.inv?.getItem?.(REFINING_TABLE.slots.equipment)
    if (!stack?.typeId || !preview?.definition) {
        return { success: false, message: 'Missing Equipment' }
    }

    const state = readStatsState(stack, preview.definition)
    const xpTank = getRefiningXpTank(machine)
    const availableXp = getXpTankAmount(xpTank)
    if (availableXp < preview.xpCost) {
        return { success: false, message: 'Need More XP' }
    }

    if (preview.requiresTotem) {
        const totemStack = machine?.inv?.getItem?.(REFINING_TABLE.slots.totem)
        if (normalizeId(totemStack?.typeId) !== normalizeId(REFINING_TABLE.defaults.unlockCatalystId)) {
            return { success: false, message: 'Insert Runic Core' }
        }
    }

    const refinement = readPendingRefinement(machine) ?? buildRolledRefinement({
        ...preview,
        state,
    })

    const abilityData = {
        ...(state?.abilityData ?? {}),
        uniqueUnlocked: preview.requiresTotem ? true : state?.abilityData?.uniqueUnlocked === true,
        operatorMode: state?.abilityData?.operatorMode ?? 'crushy',
    }

    const result = writeStatsState(stack, preview.definition, {
        ...state,
        abilityData,
        refinement,
    }, {
        syncLore: true,
        forceLore: true,
    })

    machine.inv.setItem(REFINING_TABLE.slots.equipment, stack)
    if (xpTank && typeof xpTank.add === 'function') {
        xpTank.add(-preview.xpCost)
    }
    consumeInputSlot(machine, REFINING_TABLE.slots.chip, 1)
    if (preview.effectiveIngots > 0) {
        consumeInputSlot(machine, REFINING_TABLE.slots.ingot, preview.effectiveIngots)
    }
    if (preview.requiresTotem) {
        consumeInputSlot(machine, REFINING_TABLE.slots.totem, 1)
    }
    clearPendingRefinement(machine)

    return {
        success: true,
        refinement,
        preview: buildRefiningPreview(machine, {
            stack,
            definition: preview.definition,
            state: result.state,
        }),
    }
}

function consumeInputSlot(machine, slot, amount) {
    const stack = machine?.inv?.getItem?.(slot)
    if (!stack?.typeId) return

    const remaining = Math.max(0, Number(stack.amount ?? 0) - Math.max(0, Number(amount ?? 0)))
    if (remaining <= 0) {
        machine.inv.setItem(slot, undefined)
        return
    }

    stack.amount = remaining
    machine.inv.setItem(slot, stack)
}

function consumeRefiningEnergy(machine, preview) {
    const progress = machine.getProgress()
    const consumption = machine.boosts?.consumption ?? 1
    const energyToConsume = Math.min(
        machine.energy.get(),
        machine.rate,
        Math.max(0, preview.energyCost - progress) * consumption,
    )

    if (energyToConsume <= 0) return

    machine.energy.consume(energyToConsume)
    machine.addProgress(energyToConsume / Math.max(consumption, Number.EPSILON))
}

function buildConfirmButtonLore(preview) {
    if (!preview?.valid) {
        return [
            `§7Issue: §f${preview?.problem ?? 'Insert Equipment'}`,
            '§7Supported vanilla and StatsCore gear work here.',
        ]
    }

    if (!preview.chipConfig) {
        return [
            '§7Insert a chip to define the roll range.',
            '§7Higher chip tiers improve the odds.',
        ]
    }

    if (preview.requiresTotem && !preview.totemPresent) {
        return [
            '§7Sacrifice a Runic Core',
            '§7to awaken the item ability.',
            `§7Ability: §e${(preview.potentialAbilityNames ?? []).join(' §8+ §e') || 'Locked'}`,
        ]
    }

    if (!preview.ready) {
        return [
            `§7Need: §f${FluidManager.formatFluid(preview.xpCost)} XP`,
            `§7Tank: §f${formatFluidTankBuffer(preview.xpTank, REFINING_TABLE.defaults.xpFluidType)}`,
        ]
    }

    return [
        `§7Cost: §f${FluidManager.formatFluid(preview.xpCost)} XP`,
        `§7Energy: §f${formatEnergyCost(preview.energyCost)}`,
        `§7Roll: §f${formatPercentFromRatio(preview.range.min)} - ${formatPercentFromRatio(preview.range.max)}`,
    ]
}

function buildAbilityNames(attributes, state) {
    return collectStatsAbilityNames(attributes, { state })
}

function normalizeAbilityDescriptionKey(value) {
    const normalized = normalizeId(value)
    if (!normalized) return ''
    if (normalized.endsWith(' operator')) return 'operator'
    return normalized
}

function getSpecialAbilityDescription(name) {
    return SPECIAL_ABILITY_DESCRIPTIONS[normalizeAbilityDescriptionKey(name)]
        ?? 'Special ability with unique behavior for this equipment.'
}

function getVisibleAbilityNames(preview = {}) {
    const activeNames = buildAbilityNames(preview.attributes ?? {}, preview.state)
    if (activeNames.length > 0) return activeNames
    if (preview.requiresTotem) {
        return Array.isArray(preview.potentialAbilityNames) ? preview.potentialAbilityNames : []
    }
    return []
}

function buildAbilityDescriptionLore(preview = {}) {
    return getVisibleAbilityNames(preview)
        .map((name) => `§r§7${name}: §f${getSpecialAbilityDescription(name)}`)
}

function formatCompactStatLine(label, ratio, suffix = '') {
    return `§r${label} +${formatPercentFromRatio(ratio, 1)}${suffix}`
}

function buildAttributeSummaryLines(preview = {}, maxLines = 4) {
    const attributes = preview.attributes ?? {}
    const lines = []

    const push = (value) => {
        if (!value || lines.length >= maxLines) return
        lines.push(value)
    }

    const damageBonus = Math.max(0, Number(attributes.damageMultiplier ?? 1) - 1)
    const flatDamageBonus = Math.max(0, Number(attributes.flatDamageBonus ?? 0))
    const critChance = Math.max(0, Number(attributes.crit?.chance ?? 0))
    const critDamage = Math.max(0, Number(attributes.crit?.multiplier ?? 1) - 1)
    const penetration = Math.max(0, Number(attributes.penetration?.percent ?? 0))
    const lifesteal = Math.max(0, Number(attributes.lifesteal?.percent ?? 0))
    const oreBonus = Math.max(0, Number(attributes.mining?.oreBonusChance ?? 0))
    const yieldBonus = Math.max(0, Number(attributes.mining?.bonusDropChance ?? 0))
    const preserving = Math.max(
        0,
        Number(attributes.mining?.durabilitySaveChance ?? 0),
        Number(attributes.support?.durabilityPreserveChance ?? 0),
    )
    const reduction = Math.max(0, Number(attributes.support?.damageReduction ?? 0))
    const evasion = Math.max(0, Number(attributes.support?.negateAllDamageChance ?? 0))

    if (preview.definition?.type === ITEM_TYPES.support) {
        push(formatCompactStatLine('Damage Reduction', reduction))
        push(formatCompactStatLine('Evasion', evasion))
        push(formatCompactStatLine('Preserving', preserving))
    } else {
        if (flatDamageBonus > 0) {
            push(`§rAttack Damage +${Math.floor(flatDamageBonus)}`)
        }
        push(formatCompactStatLine('Bonus Damage', damageBonus))
        push(formatCompactStatLine('Critical Chance', critChance))
        push(formatCompactStatLine('Critical Damage', critDamage))
        push(formatCompactStatLine('Armor Penetration', penetration))
        push(formatCompactStatLine('Lifesteal', lifesteal))
        if (preview.definition?.type !== ITEM_TYPES.weapon) {
            push(formatCompactStatLine('Ore Bonus', oreBonus))
            push(formatCompactStatLine('Bonus Yield', yieldBonus))
            push(formatCompactStatLine('Preserving', preserving))
        }
    }

    return lines.filter(Boolean)
}

function buildEquipmentSummaryLines(preview = {}, maxLines = 4) {
    if (!preview?.definition) return []

    const lines = [
        `§r${formatRefineProfile(preview.definition.type)} §8| §r${titleCaseIdentifier(preview.definition.tier ?? 'unknown')}`,
    ]

    lines.push(...buildAttributeSummaryLines(preview, Math.max(0, maxLines - lines.length)))

    if (lines.length < maxLines) {
        lines.push(`§rLevel ${preview.state?.level ?? 1} §8| §r${formatRefineGrade(preview.state?.refinement?.grade)}`)
    }

    return lines.slice(0, maxLines)
}

function buildEquipmentPanelLore(preview = {}) {
    const attributes = preview.attributes ?? {}
    const details = []
    const abilityNames = buildAbilityNames(attributes, preview.state)
    const lockedAbilityNames = Array.isArray(preview.potentialAbilityNames) ? preview.potentialAbilityNames : []
    const flatDamageBonus = Math.max(0, Number(attributes.flatDamageBonus ?? 0) || 0)
    const pushPercent = (label, value) => {
        const numeric = Math.max(0, Number(value ?? 0) || 0)
        if (numeric <= 0) return
        details.push(`§r§7${label}: §9+${formatPercentFromRatio(numeric, 1)}`)
    }

    if (flatDamageBonus > 0) {
        details.push(`§r§7Attack Damage: §9+${Math.floor(flatDamageBonus)}`)
    }

    pushPercent('Bonus Damage', Math.max(0, Number(attributes.damageMultiplier ?? 1) - 1))
    pushPercent('Critical Chance', attributes.crit?.chance)
    pushPercent('Critical Damage', Math.max(0, Number(attributes.crit?.multiplier ?? 1) - 1))
    pushPercent('Armor Penetration', attributes.penetration?.percent)
    pushPercent('Lifesteal', attributes.lifesteal?.percent)
    pushPercent('Ore Bonus', attributes.mining?.oreBonusChance)
    pushPercent('Bonus Yield', attributes.mining?.bonusDropChance)
    pushPercent('Preserving', attributes.mining?.durabilitySaveChance)
    pushPercent('Damage Reduction', attributes.support?.damageReduction)
    pushPercent('Evasion', attributes.support?.negateAllDamageChance)
    pushPercent('Preserving', attributes.support?.durabilityPreserveChance)

    if (preview.definition) {
        details.push(`§r§7Level: §f${preview.state?.level ?? 1}`)
        details.push(`§r§7Refine: §f${formatRefineGrade(preview.state?.refinement?.grade)} ${preview.state?.refinement?.quality ? `(${formatPercentFromRatio(preview.state.refinement.quality)})` : ''}`.trim())
    }

    if (abilityNames.length > 0) {
        details.push(`§r§7Ability: §g${abilityNames.join(' §8+ §g')}`)
    } else if (preview.requiresTotem && lockedAbilityNames.length > 0) {
        details.push(`§r§7Ability: §8Locked §8→ §e${lockedAbilityNames.join(' §8+ §e')}`)
        details.push('§r§7Awakening: §eRunic Core')
    }

    details.push(...buildAbilityDescriptionLore(preview))

    if (preview.definition?.type === ITEM_TYPES.support) {
        const immunities = Array.isArray(attributes.support?.damageImmunities) && attributes.support.damageImmunities.length > 0
            ? attributes.support.damageImmunities.map(titleCaseIdentifier).join(', ')
            : 'None'
        const vulnerabilityPenalty = Math.max(0, Number(attributes.support?.vulnerabilityPenalty ?? 0) || 0)
        const vulnerabilities = Array.isArray(attributes.support?.vulnerabilities) && attributes.support.vulnerabilities.length > 0
            ? attributes.support.vulnerabilities
                .map((value) => `${titleCaseIdentifier(value)}${vulnerabilityPenalty > 0 ? ` (+${formatPercentFromRatio(vulnerabilityPenalty, 1)})` : ''}`)
                .join(', ')
            : 'None'
        details.push(`§r§7Damage Immunity: §f${immunities}`)
        details.push(`§r§7Vulnerability: §f${vulnerabilities}`)
    }

    return details
}

function buildEquipmentLabel(preview) {
    if (!preview?.equipment?.typeId) {
        return {
            title: '§rEquipment Details',
            lines: [
                '§rInsert equipment',
                '§rto inspect stats',
                '§rand special abilities',
            ],
            lore: [],
        }
    }

    if (!preview?.definition) {
        return {
            title: formatItemName(preview.equipment.typeId),
            lines: [
                '§rUnsupported Item',
                '§rNo StatsCore profile',
                '§ravailable for this gear',
            ],
            lore: [],
        }
    }

    return {
        title: formatItemName(preview.equipment.typeId),
        lines: buildEquipmentSummaryLines(preview),
        lore: buildEquipmentPanelLore(preview),
    }
}

function renderChanceDisplay(machine, preview, refreshUi = true) {
    if (!refreshUi) return
    machine.setLabel(buildEquipmentLabel(preview), REFINING_TABLE.slots.chances)
    machine.displayEnergy(REFINING_TABLE.slots.energy)
    machine.displayProgress(REFINING_TABLE.slots.progress)
}

function formatDiagnosticValue(value, fallback = 'None') {
    return typeof value === 'string' && value.length > 0 ? value : fallback
}

function formatBooleanState(value, trueLabel = 'Ready', falseLabel = 'Pending') {
    return value ? trueLabel : falseLabel
}

function buildMachineLore(preview = {}, refinement = null) {
    const lines = []
    const overclockLine = buildOverclockLoreLine(preview.machine)?.replace(/^§r/, '')

    lines.push(`§7Status: §f${preview.problem ?? 'Ready to confirm'}`)
    lines.push(`§7XP Tank: §f${formatFluidTankBuffer(preview.xpTank, REFINING_TABLE.defaults.xpFluidType)}`)
    lines.push(`§7Energy Buffer: §f${formatMachineEnergyBuffer(preview.machine)}`)
    lines.push(`§7Operation Cost: §f${formatEnergyCost(preview.energyCost ?? REFINING_TABLE.defaults.idleEnergyCost)}`)

    lines.push(`§7Equipment Slot: §f${!preview.equipment?.typeId
        ? 'Insert Equipment'
        : (preview.definition ? 'Loaded' : 'Unsupported Item')}`)

    lines.push(`§7Chip: §f${formatDiagnosticValue(preview.chipConfig?.label, 'Insert Chip')}`)

    lines.push(`§7Ingot: §f${formatDiagnosticValue(preview.ingotConfig?.label, preview.ingotStack?.typeId ? 'Unsupported Ingot' : 'Optional')} §8x§f${preview.effectiveIngots ?? 0}`)
    lines.push(`§7Runic Core Slot: §f${preview.requiresTotem
        ? (preview.totemPresent ? 'Runic Core Ready' : 'Insert Runic Core')
        : 'Not required'}`)

    if (preview.valid && preview.chipConfig) {
        lines.push(`§7Roll Range: §f${formatPercentFromRatio(preview.range.min)} - ${formatPercentFromRatio(preview.range.max)}`)
        lines.push(`§7XP Cost: §f${FluidManager.formatFluid(preview.xpCost)} XP`)
        lines.push(`§7Strong: §f${formatPercentFromRatio(preview.odds.strong)} §8| §7Masterwork: §f${formatPercentFromRatio(preview.odds.masterwork)}`)
        lines.push(`§7Transcendent: §f${formatPercentFromRatio(preview.odds.transcendent)}`)
        lines.push(`§7Inputs: §f${formatBooleanState(Boolean(preview.chipConfig), 'Chip OK', 'Need Chip')} §8| §7XP: §f${formatBooleanState(preview.ready, 'Enough', 'Missing')}`)
    }

    if (refinement?.grade) {
        lines.push(`§bResult: §f${formatRefineGrade(refinement.grade)} (${formatPercentFromRatio(refinement.quality ?? 0)})`)
    }

    if (overclockLine) {
        lines.push(overclockLine)
    }

    return lines
}

function buildFooterLines(preview = {}, refinement = null) {
    const lines = []
    if (!preview.equipment?.typeId) {
        lines.push('Awaiting Equipment')
    }
    if (preview.requiresTotem && !preview.totemPresent) {
        lines.push('Need Runic Core')
    }
    if (preview.valid && preview.chipConfig) {
        lines.push(`Need ${FluidManager.formatFluid(preview.xpCost)} XP`)
        lines.push(`Tank ${FluidManager.formatFluid(preview.availableXp ?? 0)}`)
    }
    if (refinement?.grade) {
        lines.push(`Result ${formatRefineGrade(refinement.grade)}`)
    }
    return lines
}

function formatRefineProfile(type) {
    if (type === ITEM_TYPES.weapon) return 'Combat'
    if (type === ITEM_TYPES.tool) return 'Mining'
    if (type === ITEM_TYPES.hybrid) return 'Hybrid'
    if (type === ITEM_TYPES.support) return 'Defense'
    return 'Unknown'
}

function formatRefineGrade(grade) {
    const key = normalizeId(grade)
    if (key === 'transcendent') return 'Transcendent'
    if (key === 'masterwork') return 'Masterwork'
    if (key === 'exceptional') return 'Exceptional'
    if (key === 'steady') return 'Steady'
    if (key === 'rough') return 'Rough'
    return 'Unrefined'
}

function showMachineWarning(machine, message, preview = {}, resetProgress = true, refreshUi = true) {
    machine.off()
    if (!refreshUi) return

    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore({
            ...preview,
            machine,
        }),
        {
            footerLines: buildFooterLines(preview),
            displayModel: 'minimal',
        },
    )
    renderChanceDisplay(machine, preview, true)
}

function showMachineStatus(machine, message, preview = {}, refreshUi = true, refinement = null) {
    machine.on()
    if (!refreshUi) return

    machine.showStatus(
        message,
        buildMachineLore({
            ...preview,
            machine,
        }, refinement),
        {
            footerLines: buildFooterLines(preview, refinement),
            displayModel: 'minimal',
        },
    )
    renderChanceDisplay(machine, preview, true)
}
