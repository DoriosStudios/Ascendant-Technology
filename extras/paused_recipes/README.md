# Recipes archived during v0.9.2

Six recipes remain paused outside `BP/recipes`: Mob Chamber Controller, Mob
Chamber Core, Essence Module, Universal Cable, Universal Importer and Universal
Exporter. Their reactivation depends on UtilityCraft design decisions.

Alchemical Station acquisition is restored for the next update in Creative,
Workbench and Assembler. Its copy here is a historical backup; its generator now
writes the active recipe under `BP/recipes` and preserves the selection protocol.

Their block IDs, definitions and runtime scripts remain in the packs for existing
worlds. Shared titanium casings, ports and multiblock modules remain available.
Mob Chamber Crafter registration is not imported, and Universal Importer/Exporter
entries are absent from the active Crafter additions.

To resume a feature, restore its recipe to the matching path under `BP/recipes`
and review its creative category, catalog entry, Crafter registration and generator
together. Moving the JSON alone does not restore all acquisition paths.
