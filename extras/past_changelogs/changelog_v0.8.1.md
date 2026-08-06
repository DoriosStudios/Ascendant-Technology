Small hotfix solving some issues that appeared with 1.26.20 update. Unlike UtilityCraft, Ascendant Technology had considerably less issues.

## BLOCKS
### Ores
- Aetherium Ore (Overworld)
    - Doubled spawn rate.
- Titanium Ore
    - Increased spawn rate by ~70%
## ITEMS
### Armor
- Aetherium Armor Set
    - Base Stats (all pieces):
        - Added 1.2% Damage Reduction for each armor piece.
    - Boots:
        - Added 0.78% chance to negate incoming damage.
    - Chestplate:
        - Added 1.2% chance to negate incoming damage.
    - Helmet:
        - Added 0.96% chance to negate incoming damage.
    - Leggings:
        - Added 0.9% chance to negate incoming damage.

- Titanium Armor Set
    - Base Stats (all pieces):
        - Added 0.9% Damage Reduction for each armor piece.
    - Boots:
        - Added 0.52% chance to negate incoming damage.
    - Chestplate:
        - Added 0.8% chance to negate incoming damage.
    - Helmet:
        - Added 0.64% chance to negate incoming damage.
    - Leggings:
        - Added 0.6% chance to negate incoming damage.

### Tools
- Improved Fluid Capsules handling.
- Aiots
    - Reduced shovel area from 7x7 to 3x3.
- Paxels
    - Now correctly breaks siftable blocks.
- Hammers now apply mapped special drops across supported vanilla ore families.
    - Common ores such as Coal, Copper, Iron, Gold, and Nether Quartz now lean toward dust outputs.
    - Rarer ores such as Diamond, Emerald, Redstone, Lapis, Nether Gold, and Ancient Debris now use tighter yields or chunk-style outputs where that better matches the available material chain.

## RECIPES
### Catalyst Weaver
- Added crushed gem recovery recipes.
    - Diamond Dust, Emerald Dust, Quartz Dust, and Amethyst Dust can now be restored with Iron Ingots and a small amount of Lava.

### Machines
- Updated several late-game machine recipes to use Titanium Plates instead of raw Titanium Ingots.
    - This now applies to the Network Center, Titanium Conveyors, and related machine progression.
- Hyper Processing Upgrade now uses a Titanium Plate in its Catalyst Weaver recipe.

## BUG FIXES
- Fixed a texture issue with Infinite Capsules.
- Fixed Duplicator copies losing item identity data.
    - Duplicated outputs now preserve dynamic properties and avoid merging into mismatched metadata stacks.
- Fixed some machines not working properly since 1.26.20 update.

