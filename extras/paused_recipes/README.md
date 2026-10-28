# Paused recipes for v0.9.2

These seven recipes are kept outside `BP/recipes` so Bedrock does not load them:
Alchemical Station, Mob Chamber Controller, Mob Chamber Core, Essence Module,
Universal Cable, Universal Importer and Universal Exporter.

Their block IDs, definitions and runtime scripts remain in the packs for existing
worlds. Shared titanium casings, ports and multiblock modules remain available.
Mob Chamber Crafter registration is not imported, and Universal Importer/Exporter
entries are absent from the active Crafter additions. The Alchemical Station
generator writes its recipe here and keeps its creative category hidden.

To resume a feature, restore its recipe to the matching path under `BP/recipes`
and review its creative category, catalog entry, Crafter registration and generator
together. Moving the JSON alone does not restore all acquisition paths.
