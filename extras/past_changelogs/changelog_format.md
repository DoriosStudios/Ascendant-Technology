Base file for a changelog in markdown format following Ascendant Technology's patchnote conventions.

## Changelog header and summary

Start every changelog with a version header and a short summary paragraph (1–3 sentences).
Use the same tone and language as the rest of the file (English is the default; Portuguese is acceptable if the release notes are fully in PT).

Recommended patterns based on past releases:

```Markdown
# v0.7.2

Small fix regarding some recipes and text entries.
```

Drafts and previews should include a suffix:

```Markdown
# v0.3.0-alpha (Draft)

Pre-release snapshot focused on heavy-duty storage, smarter automation, and UI quality-of-life polish ahead of broader testing.
```

Keep one blank line between the summary and the first section header.

## Section layout

Use uppercase section headers by default (this is the most common pattern in past changelogs). If you choose Title Case, keep it consistent in the same file.

Main sections observed in past changelogs:

```Markdown
## BLOCKS
## ITEMS
## RECIPES (When there's too many recipe changes, consider splitting into subcategories)
## UI or ## UI/UX
## FLUIDS (Optional, when liquid systems change)
## BUG FIXES (or ## Bug Fixes)
## TECHNICAL CHANGES (Optional, for modpack devs and advanced users)
## THIRD-PARTY / INTEGRATION (Optional, for compatibility notes)
```

Always follow the order above when including multiple sections. Omit sections that have no changes in the release.

---

## Subsection layout

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

## Writing rules (based on past changelogs)

Some simple rules to keep in mind:
- Use clear and concise language, such as:
    - "Added", "Removed", "Increased", "Decreased", "Fixed", "Updated", "Modified"
- Use proper capitalization for item and block names.
- When listing multiple changes for a single item or block, use sub-bullets for clarity
- Always follow alphabetical order within sections and sub-sections for easy navigation.
  - "Changes" overwrites this rule. "Added" always comes first, then "Changes" and then "Removed".
  - Exceptions: keep tier progressions, step-by-step flows, and issue-linked groups in logical order instead of alphabetical order.
- Remember to include brief summaries at the top of each changelog file, as shown in the examples. These are important for users to quickly understand the main features of the update.

Scope and detail guardrails (important for consistency):
- Keep player-facing sections (BLOCKS, ITEMS, RECIPES, UI/UX, FLUIDS, BUG FIXES) free of internal IDs, file paths, script names, constants, or debug tooling.
- BUG FIXES should describe user-visible outcomes. Root causes and developer-only issues belong in TECHNICAL CHANGES.
- Omit purely dev-only changes (formatting-only, refactors, linting) unless they affect pack consumers or modpack developers.
- Avoid explanation-only bullets; each bullet should state what changed and, optionally, the player impact.
- Use a short Note only when behavior might surprise players.
- For tiered items (modules/armor/tools), list tiers in order with a one-line effect each; keep it concise and player-facing.

Additional consistency rules from recent files:
- Prefer one concise summary paragraph at the top. Avoid lists in the summary.
- Use **bold** for per-item sub-entries when listing multiple stats (Armor/Tools examples below).
- Keep units consistent inside a single file: use the same spacing and casing for `mB`, `kDE`, `DE`, `MB`, etc.
- When referencing files, components, or tags, wrap them in backticks (e.g., `utilitycraft:special_container`).
- When a change impacts players and scripts, mention both the player-facing effect and the technical change in sub-bullets.

In "TECHNICAL CHANGES", use more technical language suitable for modpack developers and advanced users. Don’t hesitate to include implementation details that may help them understand the changes better, including config keys, ScriptEvents, or short inline code references.

## Footer links (optional, used in recent releases)

When the release references previous notes, add a short footer with links:

```Markdown
---
For a full list of changes, see previous changelogs.
[Changelog v0.7.1](...) | [Changelog v0.7.0](...)
```

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