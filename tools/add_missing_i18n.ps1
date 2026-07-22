# Add missing localizations to remaining language files
Write-Host "Adding missing localizations to remaining languages..." -ForegroundColor Cyan

$languages = @("fr_FR", "de_DE", "ru_RU", "ja_JP", "zh_CN")

# Content to add (in English as placeholder for translation)
$itemsContent = @"

## Arcane Placeholders (UI)
item.utilitycraft:arcane_00=Arcane Energy
item.utilitycraft:arcane_01=Arcane Energy
item.utilitycraft:arcane_02=Arcane Energy
item.utilitycraft:arcane_03=Arcane Energy
item.utilitycraft:arcane_04=Arcane Energy
item.utilitycraft:arcane_05=Arcane Energy
item.utilitycraft:arcane_06=Arcane Energy
item.utilitycraft:arcane_07=Arcane Energy
item.utilitycraft:arcane_08=Arcane Energy
item.utilitycraft:arcane_09=Arcane Energy
item.utilitycraft:arcane_10=Arcane Energy
item.utilitycraft:arcane_11=Arcane Energy
item.utilitycraft:arcane_12=Arcane Energy
item.utilitycraft:arcane_13=Arcane Energy
item.utilitycraft:arcane_14=Arcane Energy
item.utilitycraft:arcane_15=Arcane Energy
item.utilitycraft:arcane_16=Arcane Energy

## Infinite Capsules
item.utilitycraft:aetherium_liquid_capsule_infinite=Infinite Liquified Aetherium Capsule\n§7- Holds unlimited liquified aetherium
item.utilitycraft:cryofluid_capsule_infinite=Infinite Cryofluid Capsule\n§7- Holds unlimited cryofluid
item.utilitycraft:dark_matter_liquid_capsule_infinite=Infinite Dark Matter Capsule\n§7- Holds unlimited dark matter
item.utilitycraft:lava_capsule_infinite=Infinite Lava Capsule\n§7- Holds unlimited lava
item.utilitycraft:milk_capsule_infinite=Infinite Milk Capsule\n§7- Holds unlimited milk
item.utilitycraft:water_capsule_infinite=Infinite Water Capsule\n§7- Holds unlimited water
item.utilitycraft:xp_capsule_infinite=Infinite XP Capsule\n§7- Holds unlimited liquid XP

## Modules
item.utilitycraft:ascane_module_base=§dAscane Module Base§7\n- Base component for crafting modules
"@

$blocksContent = @"

## Transportation - Bridge Path
tile.utilitycraft:conveyor_bridge_path.name=§aConveyor Bridge Path\n§7- Active bridge connection between transmitter and receiver

## Machines - Fixed Identifiers
tile.utilitycraft:duplicator.name=Duplicator\n§7- Duplicates items using dark matter\n- Accepted upgrades: §a§7, §b§7, §d§7
tile.utilitycraft:enchantment_station.name=Enchantment Station\n§7- Repairs, enchants, reinforces gear\n- Module-controlled boosts
"@

foreach ($lang in $languages) {
    $filePath = "RP/texts/$lang.lang"
    Write-Host "Processing $lang..." -ForegroundColor Yellow
    
    # Append content
    Add-Content -Path $filePath -Value $itemsContent -NoNewline
    Add-Content -Path $filePath -Value $blocksContent
    
    Write-Host "  ✓ Added localizations to $lang" -ForegroundColor Green
}

Write-Host "`n✅ All languages updated!" -ForegroundColor Green
Write-Host "Note: fr_FR, de_DE, ru_RU, ja_JP, and zh_CN use English placeholders." -ForegroundColor Cyan
Write-Host "These can be translated by community contributors ifneeded." -ForegroundColor Cyan
