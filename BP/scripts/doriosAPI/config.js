/**
 * DoriosAPI - Setup Instructions
 *
 * To ensure everything functions correctly, make sure to import the main API file
 * in your addon's main script. The import should look like this:
 *
 * ```js
 * import './DoriosAPI/index.js';
 * ```
 *
 * Additionally, the **DoriosAPI** folder must be located in the `/scripts` directory
 * of your addon structure.
 *
 * Example folder structure:
 * ```
 * /scripts
 * └── /DoriosAPI
 *     └── index.js
 * ```
 */

/**
 * Addon Configuration
 *
 * This section contains the metadata for the addon, including its name,
 * author, version, identifier, and dependencies.
 * Dependencies can have additional properties:
 * - **name**: Optional. The custom name of the dependency to display in messages. If not provided, the `identifier` will be used.
 * - **warning**: Optional. A custom warning message to display if the dependency is missing or outdated.
 *
 * Example:
 * ```js
 * const addonData = {
 *     name: "UtilityCraft: Heavy Machinery",
 *     author: "Dorios Studios",
 *     identifier: "utilitycraft_heavy_machinery",
 *     version: "0.3.0",
 *     dependencies: {
 *         "utilitycraft": {
 *             version: "3.3.5",  // Required version
 *             name: "UtilityCraft",  // Custom name to display
 *             warning: "Please update to the latest version."  // Custom warning message
 *         }
 *     }
 * };
 * ```
 */
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

/**
 * Module Imports
 *
 * To activate a module, uncomment the import line.
 * To deactivate a module, comment out the import line.
 *
 * Example of available modules:
 * - **blockClass.js**: Logic for block utilities and machines.
 * - **playerClass.js**: Helpers for player-related actions (inventory, stats).
 * - **itemStackClass.js**: Simplified methods for item stack manipulation.
 * - **entityClass.js**: Extended methods for handling entities and interactions.
 *
 * Example imports:
 * ```js
 * import './blockClass.js'; // Block utilities
 * import './playerClass.js'; // Player helpers (disabled)
 * import './itemStackClass.js'; // Item stack handling
 * ```
 */
import './API.js'
import './dependencyChecker.js'
import './modules/blockClass.js'
import './modules/playerClass.js'
import './modules/itemStackClass.js'
import './modules/entityClass.js'

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
