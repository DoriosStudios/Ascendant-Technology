import { Generator, Energy, FluidManager } from '../../DoriosCore/main.js'

const DENSE_THERMO = Object.freeze({
    slots: Object.freeze({
        status: 1,
        fluidDisplay: 2
    }),
    properties: Object.freeze({
        heat: 'dense_thermo:heat',
        steam: 'dense_thermo:steam'
    }),
    heat: Object.freeze({
        max: 260,
        safeMin: 80,
        safeMax: 180,
        danger: 240
    }),
    steam: Object.freeze({
        cap: 64000
    })
})

const HEAT_SOURCES = Object.freeze({
    'minecraft:lava': 1,
    'minecraft:flowing_lava': 1,
    'minecraft:magma': 0.6,
    'minecraft:fire': 0.4,
    'minecraft:soul_fire': 0.75,
    'minecraft:campfire': 0.3,
    'minecraft:soul_campfire': 0.5
})

const COOLANTS = Object.freeze({
    cryofluid: 1.15,
    saline_coolant: 1
})

DoriosAPI.register.blockComponent('dense_thermo_matrix', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnGeneratorEntity(e, settings, (entity) => {
            entity.setItem(DENSE_THERMO.slots.fluidDisplay, 'utilitycraft:progress_right_big_bar_00', 1, ' ')
            entity.setDynamicProperty(DENSE_THERMO.properties.heat, 0)
            entity.setDynamicProperty(DENSE_THERMO.properties.steam, 0)
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const generator = new Generator(e.block, settings)
        if (!generator.valid || !generator.entity) return

        const { block, entity, energy } = generator
        energy.transferToNetwork(generator.rate * 4)

        const tank = getCoolantTank(entity, settings)
        const sourceHeat = HEAT_SOURCES[block.below(1)?.typeId] ?? 0
        const coolantType = tank.getType()
        const coolantMultiplier = COOLANTS[coolantType] ?? 0

        let heat = Number(entity.getDynamicProperty(DENSE_THERMO.properties.heat) ?? 0) || 0
        let steam = Number(entity.getDynamicProperty(DENSE_THERMO.properties.steam) ?? 0) || 0

        if (sourceHeat <= 0) {
            heat = Math.max(0, heat - 2)
            generator.off()
            persistState(entity, heat, steam)
            renderStatus(generator, tank, {
                title: 'No Heat Source',
                titleColor: 'e',
                heat,
                steam,
                generated: 0
            })
            return
        }

        if (coolantMultiplier <= 0) {
            heat = Math.min(DENSE_THERMO.heat.max, heat + (sourceHeat * 3))
            generator.off()
            persistState(entity, heat, steam)
            renderStatus(generator, tank, {
                title: 'Need Cryofluid/Saline',
                titleColor: 'e',
                heat,
                steam,
                generated: 0
            })
            return
        }

        if (heat >= DENSE_THERMO.heat.danger) {
            heat = Math.max(0, heat - 4)
            generator.off()
            persistState(entity, heat, steam)
            renderStatus(generator, tank, {
                title: 'Overheat Lock',
                titleColor: 'c',
                heat,
                steam,
                generated: 0
            })
            return
        }

        if (energy.getFreeSpace() <= 0) {
            generator.off()
            persistState(entity, heat, steam)
            renderStatus(generator, tank, {
                title: 'Energy Full',
                titleColor: 'e',
                heat,
                steam,
                generated: 0
            })
            return
        }

        const efficiency = resolveHeatEfficiency(heat)
        const targetRate = Math.max(1, Math.floor(generator.rate * sourceHeat * coolantMultiplier * efficiency))
        const coolantNeed = Math.max(1, Math.ceil(targetRate / 120))
        if (tank.get() < coolantNeed) {
            heat = Math.max(0, heat - 1)
            generator.off()
            persistState(entity, heat, steam)
            renderStatus(generator, tank, {
                title: 'Low Coolant',
                titleColor: 'e',
                heat,
                steam,
                generated: 0
            })
            return
        }

        const generated = Math.min(targetRate, energy.getFreeSpace())
        if (generated > 0) {
            tank.consume(coolantNeed)
            energy.add(generated)
            heat = Math.min(DENSE_THERMO.heat.max, heat + (sourceHeat * 2))
            steam = Math.min(DENSE_THERMO.steam.cap, steam + Math.max(1, Math.floor(generated / 80)))
            generator.on()
        } else {
            heat = Math.max(0, heat - 1)
            generator.off()
        }

        persistState(entity, heat, steam)
        renderStatus(generator, tank, {
            title: generated > 0 ? 'Running' : 'Standby',
            titleColor: generated > 0 ? 'a' : 'e',
            heat,
            steam,
            generated
        })
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e)
    }
})

function getCoolantTank(entity, settings) {
    const tank = FluidManager.initializeSingle(entity)
    const cap = Number(settings?.generator?.fluid_cap)
    if (tank.getCap() <= 0) {
        tank.setCap(Number.isFinite(cap) && cap > 0 ? cap : 16000000)
    }
    return tank
}

function resolveHeatEfficiency(heat) {
    if (heat >= DENSE_THERMO.heat.safeMin && heat <= DENSE_THERMO.heat.safeMax) {
        return 1.25
    }
    if (heat > DENSE_THERMO.heat.safeMax) {
        return 0.8
    }
    return 0.9
}

function persistState(entity, heat, steam) {
    entity.setDynamicProperty(DENSE_THERMO.properties.heat, Math.max(0, Math.floor(heat)))
    entity.setDynamicProperty(DENSE_THERMO.properties.steam, Math.max(0, Math.floor(steam)))
}

function renderStatus(generator, tank, context) {
    const { energy } = generator
    tank.display(DENSE_THERMO.slots.fluidDisplay)
    generator.displayEnergy(0)

    generator.setLabel({
        title: `§${context.titleColor}${context.title}`,
        lore: [
            `§7Heat: §f${Math.floor(context.heat)}/${DENSE_THERMO.heat.max}`,
            `§7Steam Buffer: §f${Math.floor(context.steam)}/${DENSE_THERMO.steam.cap}`,
            `§7Coolant: §f${tank.getType() || 'empty'} ${FluidManager.formatFluid(tank.get())}/${FluidManager.formatFluid(tank.getCap())}`,
            `§7Generated: §f${Energy.formatEnergyToText(context.generated)}/t`,
            `§7Energy: §f${Math.floor(energy.getPercent())}%`
        ]
    }, DENSE_THERMO.slots.status)
}