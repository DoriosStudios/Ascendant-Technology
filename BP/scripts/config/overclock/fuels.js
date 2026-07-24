// @ts-check

import { registerOverclockFuels } from "../../ATCore/overclock/index.js";

registerOverclockFuels({
    "utilitycraft:titanium": {
        duration: 500,
        power: 1,
        effectiveness: 1.25,
    },
    "minecraft:copper_ingot": {
        duration: 400,
        power: 0.5,
        effectiveness: 2,
    },
    "utilitycraft:energized_iron_ingot": {
        duration: 50,
        power: 3,
        effectiveness: 1.5,
    },
});
