Base file for a changelog in markdown format following Ascendant Technology's patchnote conventions.

Firstly, we have the main sections of the changelog:

```Markdown
## BLOCKS
## ITEMS
## RECIPES (When there's too many recipe changes, consider splitting into subcategories)
## UI/UX
## BUG FIXES
## TECHNICAL CHANGES (Optional, for modpack devs and advanced users)
## THIRD-PARTY INTEGRATION (Optional, for compatibility notes)
```

Inside each section, use bullet points to list changes. For example:

Blocks section with subcategories:
```Markdown
## BLOCKS
### General -- Section for general block changes
- Addition description 1. -- "Added Block X"
  - Sub-bullet for additional details, if necessary.
- Change description 1.
  - Sub-bullet for additional details, if necessary.
- Change description 2.
### Generators -- Section for generator-specific changes
- Added Generator Name -- "Added Generator Y"
    - Addition description 1.
      - Sub-bullet for additional details, if necessary.
- Generator Name
    - Change description 1.
      - Sub-bullet for additional details, if necessary.
    - Change description 2.
### Machines -- Section for machine-specific changes with sub-bullets for each machine
- Added Machine Name -- "Added Machine X"
    - Addition description 1.
      - Sub-bullet for additional details, if necessary.
- Machine Name
    - Change description 1.
      - Sub-bullet for additional details, if necessary.
    - Change description 2.
### Overclock -- Custom section for a newly introduced system
(brief description of the system; keep it straightforward and concise)
- Added Overclock Component -- "Added Overclock Component A"
    - Addition description 1.
      - Sub-bullet for additional details, if necessary.
### Transportation -- Section for transportation-specific changes
- Added Transportation Name -- "Added Transportation Z"
    - Addition description 1.
      - Sub-bullet for additional details, if necessary.
- Transportation Name
    - Change description 1.
      - Sub-bullet for additional details, if necessary.
    - Change description 2.
```

Items section with subcategories:
```Markdown
## ITEMS
### General -- Section for general item changes. Use sub-bullets for additional details, if needed.
- Item addition description 1. -- "Added Item X"
  - Sub-bullet for additional details, if needed. Most of the times, "Added" items needs descriptions and values, unless it's self-explanatory.
- Item change description 1. -- "Item Y:"
  - Sub-bullet for the changes.
- Item removal description 1. -- "Removed Item Z"
  - Sub-bullet for additional details, if needed.
### Category Name -- Section for specific item categories (e.g., Aetherium Tools, Titanium Armor)
- Item addition description 1. -- "Added Item A"
  - Sub-bullet for additional details, if needed.
```

Basically, follow the structure and formatting demonstrated in the provided changelog snippets for consistency.

Some simple rules to keep in mind:
- Use clear and concise language, such as:
    - "Added", "Removed", "Increased", "Decreased", "Fixed", "Updated", "Modified"
- Use proper capitalization for item and block names.
- When listing multiple changes for a single item or block, use sub-bullets for clarity
- Always follow alphabetical order within sections and sub-sections for easy navigation.
    - "Changes" overwrites this rule. "Added" always comes first, then "Changes" and then "Removed".
- Remember to include brief summaries at the top of each changelog file, as shown in the examples. These are important for users to quickly understand the main features of the update.

In "TECHNICAL CHANGES", use more technical language suitable for modpack developers and advanced users. Don't hesitate to include implementation details that may help them understand the changes better, even if it needs to show code snippets or configuration changes.

Here are some examples of how to format specific changes:
```Markdown
## ITEMS
### Armor
- Added Titanium Armor Set:
    - **Helmet:** Provides X armor points and Y durability;
        - Additional detail about the helmet, if necessary. For example, special abilities or effects, as well as if it has knockback resistance.
    - **Chestplate:** Provides X armor points and Y durability;
        - Additional detail about the chestplate, if necessary. For example, special abilities or effects, as well as if it has knockback resistance.
    - **Leggings:** Provides X armor points and Y durability;
        - Additional detail about the leggings, if necessary. For example, special abilities or effects, as well as if it has knockback resistance.
    - **Boots:** Provides X armor points and Y durability;
        - Additional detail about the boots, if necessary. For example, special abilities or effects, as well as if it has knockback resistance.
### Tools
- Added Titanium Tools:
    - **Vanilla:** 
        - Sword, with X durability and Y attack damage;
        - Axe, with X durability and Y attack damage;
        - Pickaxe, with X durability and Y attack damage;
        - Shovel, with X durability and Y attack damage;
        - Hoe, with X durability and Y attack damage;
    - **Utilitycraft:** 
        - Paxel, with X durability and Y attack damage;
        - Hammer, with X durability and Y attack damage;
        - AiOT, with X durability and Y attack damage;
```

```Markdown
## RECIPES
### General
- The following items have had their recipes modified or added:
    - Item A
    - Item B
    - Item C
### Recipes for Machine X (Infuser recipes, for example)
- Added new recipes for Machine X:
    - Item A: Infuse Item B on Item C
    - Item D: Infuse Item E on Item F
```

If an item or block has a custom component inside of it, suck as "utilitycraft:special_container", "utilitycraft:mesh" or similar, mention it in the description when adding or modifying it. For example:

```Markdown
- Added Titanium Mesh:
    - Tier: 6,
    - Amount Multiplier: 1x
```