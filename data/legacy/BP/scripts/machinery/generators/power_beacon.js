import { Energy, Generator, getButtonPanelValue, syncButtonPanel } from '../../DoriosCore/main.js'

const POWER_BEACON_TARGET_TYPES = Object.freeze([
    'utilitycraft:machine',
    'utilitycraft:machine_entity'
])

const POWER_BEACON_PANEL = Object.freeze({
    id: 'power_beacon',
    namespace: 'at',
    defaults: Object.freeze({
        transmit_enabled: true
    }),
    buttons: [
        Object.freeze({
            id: 'transmission_toggle',
            slot: 2,
            type: 'toggle',
            property: 'transmit_enabled',
            title: 'Transmission',
            activeValue: true,
            inactiveValue: false,
            pressHint: 'Take the button item to toggle transmission.',
            getLore: ({ value }) => [
                `§7Output: §f${value === false ? 'Disabled' : 'Enabled'}`,
                '§7Toggles wireless energy output.'
            ]
        })
    ]
})

function collectTargets(entity, range) {
    if (!entity?.dimension) return []

    const targets = []
    const seen = new Set()
    const sourcePos = {
        x: Math.floor(entity.location.x),
        y: Math.floor(entity.location.y),
        z: Math.floor(entity.location.z)
    }

    const nearby = []
    for (const typeId of POWER_BEACON_TARGET_TYPES) {
        const found = entity.dimension.getEntities({
            type: typeId,
            maxDistance: range + 1,
            location: entity.location
        })

        for (const candidate of found) {
            const key = candidate?.scoreboardIdentity?.id
                ? `id:${candidate.scoreboardIdentity.id}`
                : `${candidate?.typeId ?? 'unknown'}:${Math.floor(candidate?.location?.x ?? 0)},${Math.floor(candidate?.location?.y ?? 0)},${Math.floor(candidate?.location?.z ?? 0)}`

            if (seen.has(key)) continue
            seen.add(key)
            nearby.push(candidate)
        }
    }

    for (const target of nearby) {
        if (!target || target === entity) continue
        if (target.isValid === false) continue

        const targetPos = {
            x: Math.floor(target.location.x),
            y: Math.floor(target.location.y),
            z: Math.floor(target.location.z)
        }

        const dx = targetPos.x - sourcePos.x
        const dy = targetPos.y - sourcePos.y
        const dz = targetPos.z - sourcePos.z
        const distance = (dx * dx) + (dy * dy) + (dz * dz)

        if (distance > (range * range)) continue

        const tf = target.getComponent('minecraft:type_family')
        if (!tf?.hasTypeFamily?.('dorios:machine')) continue
        if (!tf.hasTypeFamily?.('dorios:energy_container')) continue
        if (tf.hasTypeFamily?.('dorios:energy_source')) continue
        if (tf.hasTypeFamily?.('dorios:battery')) continue

        const targetEnergy = new Energy(target)
        const space = targetEnergy.getFreeSpace()
        if (space <= 0) continue

        targets.push({
            energy: targetEnergy,
            space,
            distance
        })
    }

    targets.sort((a, b) => a.distance - b.distance)
    return targets
}

DoriosAPI.register.blockComponent('power_beacon', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnGeneratorEntity(e, settings)
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const generator = new Generator(e.block, settings)
        if (!generator.valid) return

        const { entity, energy } = generator
        const range = Math.max(1, Number(settings?.generator?.range ?? 4))
        const rate = Math.max(0, Math.floor(generator.rate))
        const transmissionEnabled = getButtonPanelValue(generator, POWER_BEACON_PANEL, 'transmit_enabled', true) !== false

        let transferred = 0
        let targetCount = 0

        if (transmissionEnabled && rate > 0) {
            let available = energy.get()
            if (available > 0) {
                const targets = collectTargets(entity, range)
                targetCount = targets.length

                const transferCap = Math.min(rate, available)
                for (let index = 0; index < targets.length; index++) {
                    if (available <= 0 || transferred >= transferCap) break

                    const remainingTargets = targets.length - index
                    const candidate = targets[index]
                    const fairShare = Math.max(1, Math.ceil((transferCap - transferred) / remainingTargets))
                    const send = Math.min(candidate.space, available, transferCap - transferred, fairShare)
                    if (send <= 0) continue

                    const sent = energy.transferTo(candidate.energy, send)
                    if (sent > 0) {
                        available -= sent
                        transferred += sent
                    }
                }
            }
        }

        if (transmissionEnabled && transferred > 0) {
            generator.on()
        } else {
            generator.off()
        }

        generator.displayEnergy(0)
        generator.setLabel({
            title: '§dPower Beacon',
            lore: [
                `§7Transmission: §f${transmissionEnabled ? 'Enabled' : 'Disabled'}`,
                `§7Range: §f${range} blocks`,
                `§7Targets: §f${targetCount}`,
                `§7Rate: §f${Energy.formatEnergyToText(rate)}/t`,
                `§7Sent: §f${Energy.formatEnergyToText(transferred)}/t`
            ]
        }, 1)

        syncButtonPanel(generator, POWER_BEACON_PANEL)
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e)
    }
})
