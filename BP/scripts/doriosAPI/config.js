export const addonData = {
    name: "UtilityCraft: Ascendant Technology",
    author: "Dorios Studios",
    identifier: "uc_ascendant_technology",
    version: "0.8.0",
    dependencies: {
        "utilitycraft": {
            name: "UtilityCraft",
            version: "3.3.6",
            warning: "UtilityCraft: Ascendant Technology is an expansion for UtilityCraft, so it requires UtilityCraft to be installed. Machines and features from UtilityCraft won't work without it."
        }
    }
}

import './API.js'
import './dependencyChecker.js'
import './blockClass.js'
import './playerClass.js'
import './itemStackClass.js'
import './entityClass.js'

import { world, system } from '@minecraft/server'
import { dependenciesRegistry, compareDependencyVersion } from './dependencyChecker.js'

// Checks if Heavy Machinery is present and if so, registers compatibility features.
const heavyMachineryID = 'uc_heavy_machinery'

export let isHeavyMachineryPresent = false
export let heavyMachineryVersion = null

export function isDependencyPresent(identifier) {
    if (typeof identifier !== 'string' || identifier.length === 0) return false
    return dependenciesRegistry.has(identifier)
}

export function refreshHeavyMachineryCompatibilityState() {
    const heavyMachinery = dependenciesRegistry.get(heavyMachineryID) ?? null
    isHeavyMachineryPresent = Boolean(heavyMachinery)
    heavyMachineryVersion = heavyMachinery?.version ?? null
    return heavyMachinery ?? null
}

world.afterEvents.worldLoad.subscribe(() => {
    system.runTimeout(() => {
        const heavyMachinery = refreshHeavyMachineryCompatibilityState()
        if (!heavyMachinery) return

        world.sendMessage("§bLooks like you're playing Ascendant Technology and Heavy Machinery together. You can use Ascendant's Cryofluid as a better coolant in Heavy Machinery!§r")

        const detectedVersion = heavyMachinery.version ?? 'unknown'

        const requiredVersion = addonData.dependencies?.[heavyMachineryID]?.version
        if (requiredVersion && detectedVersion !== 'unknown') {
            const state = compareDependencyVersion(requiredVersion, detectedVersion)
            if (state === 'outdated') {
                world.sendMessage(`§eHeavy Machinery version is outdated. Requires: §f${requiredVersion}§e, found: §f${detectedVersion}§e.`)
            }
        }
    }, 340)
})
