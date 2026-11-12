# Ascendant Technology v0.9.4

This update fixes Genetic Seed Synthesizer processing, restores missing recipes and Enderling Tear obtainability, strengthens Cryofluid, and improves fluid and capsule transfers.

> [!WARNING]
> Requires UtilityCraft 3.6.3 or newer.

## ITEMS
- **Enderling Tear**
    - Added a 0.01% drop chance from Endermen, as well from Enderman Essence.
    - Added a 1% drop chance from Enderlings from other addons.

## RECIPES
### Genetic Seed Synthesizer
- Increased Dye Seed drop amount from 1-2 to 2-4 and reduced the chance from 50% to 25%.
- Updated the Dye Seed return chance to 12%.
- Restored missing recipes for Azalea, Flowering Azalea, Chorus Fruit, Resin Seeds, and Sea Pickles.
- Restored missing Resin Clump drops from Pale Oak Saplings.

## UI/UX
- Updated Enderling Tear tooltips in all eight supported languages with drop chances and Soul Collector potion usage.
- Updated machine help with Genetic Seed Synthesizer batch processing and configurable liquid output recovery.

## FLUIDS
- Increased **Cryofluid** coolant efficiency from 1.75x to 2.5x and its coolant tier from 2 to 4.

## BUG FIXES
- Fixed missing localization entries and untranslated English text across all eight supported languages, including potion names, tooltips, machine help, network screens, and recipe books.
- Fixed the Alchemical Station recipe cost text displaying an invalid Blaze amount. It now shows 12,000 DE and 250 mB for six bottles.
- Fixed **Power Beacon** hitboxes across all five tiers, restoring mining while sneaking and opening the interface while standing. Newly placed beacons start selectable, and block selection recovers when the interaction helper is missing or its hitbox is disabled.
- Fixed breaking machines, generators, and multiblock controllers removing previously dropped blocks of the same type. Merged item stacks retain their remaining items, and repeated destruction callbacks produce a single machine drop.
- Fixed **Forger** and **Berserk** conversions consuming item stacks that were already on the ground near the mined block.
- Fixed stored energy, fluid, and gas amounts being rounded when machines are broken and placed again. New drops preserve exact stored amounts, while older resource lore remains readable.
- Fixed namespaced fluid and gas IDs being truncated when read from storage tags.
- Fixed unsupported fluids entering the **Vaporizer**, **Steam Boiler**, and legacy **Vaporworks Processor** through fluid transfers. Added a configurable liquid output face to recover fluids already stored in their input tanks.
- **Genetic Seed Synthesizer**
    - Fixed Stack Upgrades having no effect on processing. Each input now runs independent synthesis rolls up to its seed count and the installed batch multiplier, with coolant consumption scaled to the processed amount.
    - Fixed recipes with more possible outputs than the 15 output slots being blocked even with an empty output inventory, including Dye Seeds and Poppies.
    - Completed outputs now wait for inventory space and resume delivery as slots become available. Pending results survive world reloads and drop as items when the machine is broken.
    - Completed batches retain their original rolls and paid costs while waiting for output space.
- Fixed automatic capsule output being blocked by a pending conversion in the other slot on Vaporizer. Each slot can export its completed container independently.
- Fixed the missing survival source for the **Enderling Tear** required to brew Soul Collector potions.
- Fixed **Saline Coolant** compatibility values differing from Heavy Machinery. Its local values now match 1x efficiency and tier 0.
- Fixed the final transfer from a fluid tank leaving the destination fluid without a type when the emptied source entity was removed.
- Fixed **Cryofluid** compatibility with Heavy Machinery's **Thermo Reactor**. It now produces Heated Saline Coolant Gas according to the heat removed. This integration requires the accompanying Heavy Machinery update.

## THIRD-PARTY / INTEGRATION
- Enderling Tear drops recognize Enderling, Blastling, Snareling, Watchling, and Endersent IDs across addon namespaces, including prefixed and suffixed variants. Compatible mobs receive the 1% drop chance.
- Mobs declaring the `enderling` or `Enderling` family are also recognized. Projectile and inanimate families, plus projectile, ammo, goo, web, and trap IDs, are excluded.
