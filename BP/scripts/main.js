import * as DoriosLib from "./DoriosLib/index.js";

// Canonical shared foundation. These folders must stay free of AT-specific code.
import "./DoriosCore/index.js";

// New Ascendant Technology code is loaded only through these entry points.
import "./ATCore/index.js";
import "./config/index.js";
import "./features/index.js";

DoriosLib.registry.install();
DoriosLib.container.initialize();
