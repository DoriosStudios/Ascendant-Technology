# Add missing localizations to remaining language files
Write-Host "Adding missing localizations to remaining languages..." -ForegroundColor Cyan

$languages = @("fr_FR", "de_DE", "ru_RU", "ja_JP", "zh_CN")

# Content to add (in English as placeholder for translation)
$itemsContent = @"

## Steam Placeholders (UI)
item.utilitycraft:steam_00=Steam
item.utilitycraft:steam_01=Steam
item.utilitycraft:steam_02=Steam
item.utilitycraft:steam_03=Steam
item.utilitycraft:steam_04=Steam
item.utilitycraft:steam_05=Steam
item.utilitycraft:steam_06=Steam
item.utilitycraft:steam_07=Steam
item.utilitycraft:steam_08=Steam
item.utilitycraft:steam_09=Steam
item.utilitycraft:steam_10=Steam
item.utilitycraft:steam_11=Steam
item.utilitycraft:steam_12=Steam
item.utilitycraft:steam_13=Steam
item.utilitycraft:steam_14=Steam
item.utilitycraft:steam_15=Steam
item.utilitycraft:steam_16=Steam
item.utilitycraft:steam_17=Steam
item.utilitycraft:steam_18=Steam
item.utilitycraft:steam_19=Steam
item.utilitycraft:steam_20=Steam
item.utilitycraft:steam_21=Steam
item.utilitycraft:steam_22=Steam
item.utilitycraft:steam_23=Steam
item.utilitycraft:steam_24=Steam
item.utilitycraft:steam_25=Steam
item.utilitycraft:steam_26=Steam
item.utilitycraft:steam_27=Steam
item.utilitycraft:steam_28=Steam
item.utilitycraft:steam_29=Steam
item.utilitycraft:steam_30=Steam
item.utilitycraft:steam_31=Steam
item.utilitycraft:steam_32=Steam
item.utilitycraft:steam_33=Steam
item.utilitycraft:steam_34=Steam
item.utilitycraft:steam_35=Steam
item.utilitycraft:steam_36=Steam
item.utilitycraft:steam_37=Steam
item.utilitycraft:steam_38=Steam
item.utilitycraft:steam_39=Steam
item.utilitycraft:steam_40=Steam
item.utilitycraft:steam_41=Steam
item.utilitycraft:steam_42=Steam
item.utilitycraft:steam_43=Steam
item.utilitycraft:steam_44=Steam
item.utilitycraft:steam_45=Steam
item.utilitycraft:steam_46=Steam
item.utilitycraft:steam_47=Steam
item.utilitycraft:steam_48=Steam

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
