# Translation Guide for Ascendant Technology

This document explains the localization structure and guidelines for translating Ascendant Technology.

## File Structure

All language files are located in `/RP/texts/` and follow the Minecraft Bedrock Edition `.lang` format.

### Available Languages

The following languages are currently supported (defined in `languages.json`):

- **en_US** - English (United States) - Base language
- **pt_BR** - Portuguese (Brazil)
- **es_MX** - Spanish (Mexico)
- **fr_FR** - French (France)
- **de_DE** - German (Germany)
- **ru_RU** - Russian (Russia)
- **ja_JP** - Japanese (Japan)
- **zh_CN** - Chinese Simplified (China)

## Translation Key Structure

Translation keys follow these patterns:

### Blocks
```
tile.utilitycraft:<block_id>.name=<Translated Name>\n<Optional Description>
```

### Items
```
item.utilitycraft:<item_id>=<Translated Name>
```

### Entities
```
entity.utilitycraft:<entity_id>.name=<Translated Name>
```

### UI Elements
```
ui.utilitycraft.<ui_element>=<Translated Text>
at:ui.<letter>=<Translated Letter>
at:itemGroup.name.<group_name>=<Translated Group Name>
```

## Formatting Codes

Minecraft uses special formatting codes prefixed with `§` to control text color and style:

### Color Codes
- `§0` - Black
- `§1` - Dark Blue
- `§2` - Dark Green
- `§3` - Dark Aqua
- `§4` - Dark Red
- `§5` - Dark Purple
- `§6` - Gold
- `§7` - Gray
- `§8` - Dark Gray
- `§9` - Blue
- `§a` - Green
- `§b` - Aqua
- `§c` - Red
- `§d` - Light Purple
- `§e` - Yellow
- `§f` - White
- `§g` - Minecoin Gold (special)

### Format Codes
- `§r` - Reset formatting
- `§l` - Bold
- `§o` - Italic
- `§n` - Underline
- `§m` - Strikethrough
- `§k` - Obfuscated

### Special Characters in Translations

Some translations include special Unicode characters (e.g., `\uf5f0`, `\uf5f1`, `\uf5e1`) that represent custom symbols or upgrade icons. These should be preserved exactly as they appear in the English version.

## Translation Guidelines

### 1. Maintain Formatting Consistency
Always preserve the same formatting codes as the English version:

❌ **Wrong:**
```
# English
tile.example=Example §7Description

# Translation (missing §7)
tile.example=Ejemplo Description
```

✅ **Correct:**
```
# English
tile.example=Example §7Description

# Translation (preserves §7)
tile.example=Ejemplo §7Descripción
```

### 2. Preserve Line Breaks
Use `\n` to represent line breaks as shown in the English version:

```
tile.utilitycraft:absolute_container.name=Container Name\n§7- First description line\n- Second line
```

### 3. Keep Technical Terms
Some terms should remain in English or be transliterated:
- **kDE/t** (kilo-Dorios Energy per tick) - Keep as is
- **AiOT** - All-in-One Tool - Keep as is or transliterate
- **Aetherium**, **Titanium** - Material names can be transliterated but should be consistent

### 4. Maintain List Formatting
When translating lists, preserve the formatting:

```
Accepted upgrades: \n   §a§7, §b§7, §d§7
```

The colored squares (§a§7, etc.) represent upgrade types and should not be translated.

### 5. Comments
Lines starting with `##` are comments for organization:

```
## Generators
## Machines
## Items
```

These can be translated for better organization.

## Common Translation Patterns

### Block Descriptions
Blocks often include stats or functionality descriptions:

```
tile.utilitycraft:absolute_battery.name=Absolute Battery\n§7  Rate: 800 kDE/t
```

- Keep "Rate:" or translate it consistently
- Keep numerical values and units (kDE/t)
- Preserve indentation (spaces)

### Item Descriptions with Multipliers
```
item.utilitycraft:lucky_mesh=§aLucky Mesh\n§7- Max Drop Tier: Diamond\n§7- Item Multiplier: 2x
```

- Translate "Max Drop Tier" and "Item Multiplier"
- Keep the values (Diamond, 2x)
- Preserve all formatting codes

### Capsule Formats
```
item.utilitycraft:aetherium_liquid_capsule_1=Liquified Aetherium Capsule §7\n- (1 Bucket)
```

All capsules follow this pattern with §7 color code before the bucket count.

## Placeholder Entries

Some entries are placeholders for fluid states (items ending in `_00` through `_48`):

```
item.utilitycraft:overclock_00=Overclock
item.utilitycraft:overclock_01=Overclock
...
item.utilitycraft:overclock_48=Overclock
```

These represent different fluid levels and should all have the same translation.

## Validation Checklist

Before submitting a translation:

- [ ] All keys from `en_US.lang` are present
- [ ] All formatting codes (§) are preserved
- [ ] Line breaks (\n) match the English version
- [ ] Special Unicode characters are preserved
- [ ] Comments are optionally translated
- [ ] No extra or missing keys compared to English
- [ ] File is saved with UTF-8 encoding
- [ ] Language code is added to `languages.json`

## Testing Translations

To test your translations:

1. Add your language code to `/RP/texts/languages.json`
2. Place your `.lang` file in `/RP/texts/`
3. Load the addon in Minecraft Bedrock Edition
4. Go to Settings → Language and select your language
5. Verify all text appears correctly in-game

## Contributing

When adding or updating translations:

1. Fork the repository
2. Create a new branch for your translation
3. Follow the guidelines in this document
4. Test your translation in-game
5. Submit a pull request with:
   - Language file (`<lang_code>.lang`)
   - Updated `languages.json` (if adding new language)
   - Description of what was translated/fixed

## Need Help?

If you have questions about translating specific terms or maintaining consistency, please:

1. Check existing translations in other languages
2. Open an issue in the GitHub repository
3. Ask in the project's community channels

Thank you for contributing to Ascendant Technology's localization! 🌍
