export const addonData = {
    name: "Ascendant Technology",
    author: "Dorios Studios",
    identifier: "utilitycraft_ascendant_technology",
    version: "0.8.0",
    dependencies: {
        "utilitycraft": {
            name: "UtilityCraft",
            version: "3.3.6",
            warning: "Ascendant Technology is an expansion for UtilityCraft, so it requires UtilityCraft to be installed. Machines and features from UtilityCraft won't work without it."
        }
    }
}

import './API.js'
import './dependencyChecker.js'
import './blockClass.js'
import './playerClass.js'
import './itemStackClass.js'
import './entityClass.js'