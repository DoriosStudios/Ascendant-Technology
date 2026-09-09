# Compactor material coverage

The Compactor pools matching items across its nine input slots and processes one
material-consolidation step at a time. Items do not need to occupy a crafting
pattern. Incomplete stacks and unrelated materials cannot supply a missing part
of the selected material's batch.

All 34 compactable small UtilityCraft materials are supported:

| Material family | Required for one result |
| --- | --- |
| Pebbles, dirt/sand handfuls, gravel fragments and mud balls | 4 |
| Resource chunks, including deepslate and Nether variants | 4 |
| Diamond and emerald shards | 4 |
| Nether Star fragments, shulker-shell, totem and wither-skull shards | 9 |
| Steel, energized iron and netherite nuggets | 9 |

The small-material audit compares each item with UtilityCraft's actual shaped or
shapeless crafting recipe, including ingredient counts and result quantities.
Geodes have no compaction recipe: UtilityCraft opens them in the Crusher.
Dusts retain their existing machine-specific processing.

The steel and energized-iron chains now continue from nugget to ingot to block.
Raw steel, raw energized iron and silicon also consolidate into their respective
blocks at 9:1. The pre-existing compressed-block recipes continue those chains.
Nugget-to-ingot steps cost 800 DE; ingot-to-block steps cost 7,200 DE, including
netherite. Each added conversion has an exact Decompactor reverse.

Run `npm run audit:compactor` to compare with the sibling UtilityCraft checkout.
An alternative checkout can be passed with `npm run audit:compactor -- <path>`.
Run `npm run audit:decompactor` to validate the entire reverse recipe registry.
These checks validate source data; Minecraft runtime testing remains separate.
