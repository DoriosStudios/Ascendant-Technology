# Vaporworks Processor — compatibility

Normal acquisition moves to [Steam Boiler and Vaporizer](steam-processing.md).
The old `utilitycraft:vaporworks_processor` remains functional in existing worlds.
It retains 512,000 DE, 128,000 mB liquid/gas tanks, four upgrades and its existing
31-slot migration. Its native recipes match the advanced Vaporizer table in the
linked document. Its original Workbench recipe is archived outside BP under
`extras/legacy_recipes/`; the legacy Assembler output and creative entry are retired.

Steam is a gas supplied through gas I/O and capsules. Existing steam consumers,
including Arc-Press Forge, keep their resource identifiers and consumption rules.
The old `utilitycraft:register_vaporworks_processor_recipe` event is retained as an
alias of the advanced registry alongside `utilitycraft:register_vaporizer_recipe`.
