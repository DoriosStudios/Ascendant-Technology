import { Generator, Energy, FluidManager } from '../../DoriosCore/main.js'

const DENSE_MAGMATOR = Object.freeze({
    slots: Object.freeze({
        status: 1,
        fluidDisplay: 2
    }),
    properties: Object.freeze({
        stepEnergy: 'dense_magmator:step_energy'
    }),
    process: Object.freeze({
        fuelStepMb: 4000,
        energyPerMb: 100
    })
})

DoriosAPI.register.blockComponent('dense_magmator_core', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnGeneratorEntity(e, settings, (entity) => {
            entity.setItem(DENSE_MAGMATOR.slots.fluidDisplay, 'utilitycraft:progress_right_big_bar_00', 1, ' ')
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const generator = new Generator(e.block, settings)
        if (!generator.valid || !generator.entity) return

        const { entity, energy } = generator
        energy.transferToNetwork(generator.rate * 4)

        const tank = getLavaTank(entity, settings)
        let stepEnergy = Number(entity.getDynamicProperty(DENSE_MAGMATOR.properties.stepEnergy) ?? 0) || 0

        if (stepEnergy <= 0) {
            if (tank.getType() !== 'lava' || tank.get() < DENSE_MAGMATOR.process.fuelStepMb) {
                generator.off()
                renderStatus(generator, tank, {
                    title: tank.getType() === 'empty' ? 'No Fuel' : 'Need 4000 mB Step',
                    titleColor: 'e',
                    stepEnergy: 0,
                    generated: 0
                })
                entity.setDynamicProperty(DENSE_MAGMATOR.properties.stepEnergy, 0)
                return
            }

            tank.consume(DENSE_MAGMATOR.process.fuelStepMb)
            stepEnergy = DENSE_MAGMATOR.process.fuelStepMb * DENSE_MAGMATOR.process.energyPerMb
        }

        if (energy.getFreeSpace() <= 0) {
            generator.off()
            renderStatus(generator, tank, {
                title: 'Energy Full',
                titleColor: 'e',
                stepEnergy,
                generated: 0
            })
            entity.setDynamicProperty(DENSE_MAGMATOR.properties.stepEnergy, stepEnergy)
            return
        }

        const generated = Math.min(generator.rate, energy.getFreeSpace(), stepEnergy)
        if (generated > 0) {
            energy.add(generated)
            stepEnergy -= generated
            generator.on()
        } else {
            generator.off()
        }

        entity.setDynamicProperty(DENSE_MAGMATOR.properties.stepEnergy, Math.max(0, Math.floor(stepEnergy)))
        renderStatus(generator, tank, {
            title: generated > 0 ? 'Running' : 'Standby',
            titleColor: generated > 0 ? 'a' : 'e',
            stepEnergy,
            generated
        })
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e)
    }
})

function getLavaTank(entity, settings) {
    const tank = FluidManager.initializeSingle(entity)
    const cap = Number(settings?.generator?.fluid_cap)
    if (tank.getCap() <= 0) {
        tank.setCap(Number.isFinite(cap) && cap > 0 ? cap : 256000000)
    }
    return tank
}

function renderStatus(generator, tank, context) {
    const { energy } = generator
    tank.display(DENSE_MAGMATOR.slots.fluidDisplay)
    generator.displayEnergy(0)

    generator.setLabel({
        title: `§${context.titleColor}${context.title}`,
        lore: [
            `§74000 mB Step: §f${Math.floor(context.stepEnergy)} energy remaining`,
            `§7Generated: §f${Energy.formatEnergyToText(context.generated)}/t`,
            `§7Lava: §f${FluidManager.formatFluid(tank.get())}/${FluidManager.formatFluid(tank.getCap())}`,
            `§7Energy: §f${Math.floor(energy.getPercent())}%`
        ]
    }, DENSE_MAGMATOR.slots.status)
}