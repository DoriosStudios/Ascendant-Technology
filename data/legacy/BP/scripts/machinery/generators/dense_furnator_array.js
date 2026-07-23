import { ItemStack } from '@minecraft/server'
import { Generator, Energy } from '../../DoriosCore/main.js'

const DENSE_FURNATOR = Object.freeze({
    slots: Object.freeze({
        status: 1,
        fuelBar: 2,
        fuelInputs: Object.freeze([3, 4, 5, 6])
    }),
    properties: Object.freeze({
        fuelRemaining: 'dense_furnator:fuel_remaining',
        fuelCapacity: 'dense_furnator:fuel_capacity',
        activeWindows: 'dense_furnator:active_windows'
    }),
    defaults: Object.freeze({
        maxWindows: 4,
        fallbackFuelValue: 16000
    })
})

const FUEL_VALUES = Object.freeze({
    'minecraft:coal': 16000,
    'minecraft:charcoal': 16000,
    'minecraft:blaze_rod': 24000,
    'minecraft:dried_kelp_block': 20000,
    'minecraft:lava_bucket': 320000,
    'minecraft:coal_block': 160000
})

DoriosAPI.register.blockComponent('dense_furnator_array', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnGeneratorEntity(e, settings, (entity) => {
            entity.setItem(DENSE_FURNATOR.slots.fuelBar, 'utilitycraft:fuel_bar_0', 1, ' ')
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const generator = new Generator(e.block, settings)
        if (!generator.valid || !generator.entity || !generator.inv) return

        const { entity, energy } = generator
        energy.transferToNetwork(generator.rate * 4)

        let fuelRemaining = getNumberProperty(entity, DENSE_FURNATOR.properties.fuelRemaining)
        let fuelCapacity = getNumberProperty(entity, DENSE_FURNATOR.properties.fuelCapacity)
        let activeWindows = getNumberProperty(entity, DENSE_FURNATOR.properties.activeWindows)

        if (fuelRemaining <= 0) {
            const ignition = igniteFuelBatch(generator)
            fuelRemaining = ignition.fuelValue
            fuelCapacity = ignition.fuelValue
            activeWindows = ignition.windows
        }

        if (energy.getFreeSpace() <= 0) {
            generator.off()
            updateFuelBar(entity, fuelRemaining, fuelCapacity)
            renderStatus(generator, {
                title: 'Energy Full',
                titleColor: 'e',
                fuelRemaining,
                fuelCapacity,
                activeWindows,
                generationRate: 0
            })
            storeRuntime(entity, fuelRemaining, fuelCapacity, activeWindows)
            return
        }

        if (fuelRemaining <= 0 || activeWindows <= 0) {
            generator.off()
            updateFuelBar(entity, 0, 0)
            renderStatus(generator, {
                title: 'No Fuel',
                titleColor: 'e',
                fuelRemaining: 0,
                fuelCapacity: 0,
                activeWindows: 0,
                generationRate: 0
            })
            storeRuntime(entity, 0, 0, 0)
            return
        }

        const generationRate = Math.max(1, generator.rate * Math.max(1, activeWindows))
        const generated = Math.min(generationRate, fuelRemaining, energy.getFreeSpace())
        if (generated > 0) {
            energy.add(generated)
            fuelRemaining -= generated
            generator.on()
        } else {
            generator.off()
        }

        updateFuelBar(entity, fuelRemaining, fuelCapacity)
        renderStatus(generator, {
            title: generated > 0 ? 'Running' : 'Standby',
            titleColor: generated > 0 ? 'a' : 'e',
            fuelRemaining,
            fuelCapacity,
            activeWindows,
            generationRate
        })
        storeRuntime(entity, fuelRemaining, fuelCapacity, activeWindows)
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e)
    }
})

function igniteFuelBatch(generator) {
    const { inv } = generator
    let windows = 0
    let fuelValue = 0

    for (const slot of DENSE_FURNATOR.slots.fuelInputs) {
        if (windows >= DENSE_FURNATOR.defaults.maxWindows) break

        const stack = inv.getItem(slot)
        if (!stack?.typeId || stack.amount <= 0) continue

        const value = getFuelValue(stack)
        if (value <= 0) continue

        generator.entity.changeItemAmount(slot, -1)
        fuelValue += value
        windows += 1
    }

    return {
        windows,
        fuelValue
    }
}

function getFuelValue(stack) {
    const fixed = FUEL_VALUES[stack?.typeId]
    if (Number.isFinite(fixed) && fixed > 0) return fixed

    const fuelComp = stack?.getComponent?.('minecraft:fuel')
    const burnDuration = Number(fuelComp?.burnDuration)
    if (Number.isFinite(burnDuration) && burnDuration > 0) {
        return Math.max(1000, Math.floor(burnDuration * 2000))
    }

    return 0
}

function getNumberProperty(entity, key) {
    return Number(entity?.getDynamicProperty?.(key) ?? 0) || 0
}

function storeRuntime(entity, fuelRemaining, fuelCapacity, activeWindows) {
    entity.setDynamicProperty(DENSE_FURNATOR.properties.fuelRemaining, Math.max(0, Math.floor(fuelRemaining)))
    entity.setDynamicProperty(DENSE_FURNATOR.properties.fuelCapacity, Math.max(0, Math.floor(fuelCapacity)))
    entity.setDynamicProperty(DENSE_FURNATOR.properties.activeWindows, Math.max(0, Math.floor(activeWindows)))
}

function updateFuelBar(entity, fuelRemaining, fuelCapacity) {
    const ratio = fuelCapacity > 0 ? fuelRemaining / fuelCapacity : 0
    const frame = Math.max(0, Math.min(13, Math.floor(ratio * 13)))
    entity.setItem(DENSE_FURNATOR.slots.fuelBar, new ItemStack(`utilitycraft:fuel_bar_${frame}`, 1))
}

function renderStatus(generator, context) {
    const { energy } = generator
    const timeLeftSeconds = context.generationRate > 0
        ? Math.max(0, Math.floor(context.fuelRemaining / context.generationRate / 2))
        : 0

    generator.displayEnergy(0)
    generator.setLabel({
        title: `§${context.titleColor}${context.title}`,
        lore: [
            `§7Windows: §f${context.activeWindows}/${DENSE_FURNATOR.defaults.maxWindows}`,
            `§7Fuel: §f${Energy.formatEnergyToText(context.fuelRemaining)} / ${Energy.formatEnergyToText(context.fuelCapacity)}`,
            `§7Time Left: §f${timeLeftSeconds}s`,
            `§7Rate: §f${Energy.formatEnergyToText(context.generationRate)}/t`,
            `§7Energy: §f${Math.floor(energy.getPercent())}%`
        ]
    }, DENSE_FURNATOR.slots.status)
}