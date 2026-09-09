# Aetherium Storage Cell

Digital Storage's local `cell_store.js` declares Ultimate capacity as **409,600**
(400 KB). AT's Aetherium cell provides exactly eight times that: **3,276,800**
(3,200 KB), through these item tags:

```text
utilitycraft:ds.is_storage_cell
utilitycraft:ds.capacity.3276800
```

This is storage capacity, not a flat item count. Actual item capacity depends on
Digital Storage's accounting and per-type overhead. The cell is unstackable and
includes durability for the usage indicator. No Digital Storage code is modified.

Craft an Aetherium Storage Part from four Ultimate Storage Parts in the corners,
four Aetherium ingots on the edges and one Refined Aetherium Crystal in the center.
Combine that part with a Cell Casing. Both recipes support the UtilityCraft
Workbench and Assembler. Crafting uses parts rather than occupied storage cells.

The existing `absolute_storage_cell.png` and `absolute_storage_part.png` artwork
provides the icons. Items, recipes, catalog entries and translations belong to AT;
storage functionality and the recipe ingredients require Digital Storage.

When the sibling checkout exists, the audit passes these tags through its actual
`getStorageCellCapacity` function. In-game storage, reload and indicator QA is pending.
