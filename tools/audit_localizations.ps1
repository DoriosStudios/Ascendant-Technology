# Audit missing localizations in Ascendant Technology
Write-Host "Starting localization audit..." -ForegroundColor Cyan

# Get lang file content
$enLang = Get-Content "RP/texts/en_US.lang" -Raw

# Extract item identifiers
Write-Host "Extracting item identifiers..." -ForegroundColor Yellow
$itemIds = @()
Get-ChildItem -Path "BP/items" -Recurse -Filter "*.json" | ForEach-Object { 
    $content = Get-Content $_.FullName -Raw
    if ($content -match '"identifier":\s*"utilitycraft:([^"]+)"') { 
        $itemIds += $matches[1]
    } 
}
$itemIds = $itemIds | Sort-Object -Unique

# Extract block identifiers
Write-Host "Extracting block identifiers..." -ForegroundColor Yellow
$blockIds = @()
Get-ChildItem -Path "BP/blocks" -Recurse -Filter "*.json" | ForEach-Object { 
    $content = Get-Content $_.FullName -Raw
    if ($content -match '"identifier":\s*"utilitycraft:([^"]+)"') { 
        $blockIds += $matches[1]
    } 
}
$blockIds = $blockIds | Sort-Object -Unique

# Find missing items (format: item.utilitycraft:ID=)
Write-Host "Analyzing missing item localizations..." -ForegroundColor Yellow
$missingItems = @()
foreach ($id in $itemIds) {
    if ($enLang -notmatch "item\.utilitycraft:$([regex]::Escape($id))=") {
        $missingItems += $id
    }
}

# Find missing blocks (format: tile.utilitycraft:ID.name=)
Write-Host "Analyzing missing block localizations..." -ForegroundColor Yellow
$missingBlocks = @()
foreach ($id in $blockIds) {
    if ($enLang -notmatch "tile\.utilitycraft:$([regex]::Escape($id))\.name=") {
        $missingBlocks += $id
    }
}

# Output results
Write-Host "`n=== ANALYSIS SUMMARY ===" -ForegroundColor Green
Write-Host "Total items: $($itemIds.Count)"
Write-Host "Total blocks: $($blockIds.Count)"
Write-Host "Missing item localizations: $($missingItems.Count)" -ForegroundColor Red
Write-Host "Missing block localizations: $($missingBlocks.Count)" -ForegroundColor Red

# Save to file
$reportPath = "tools/localization_audit_report.txt"
@"
=== LOCALIZATION AUDIT REPORT ===
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

SUMMARY:
- Total items: $($itemIds.Count)
- Total blocks: $($blockIds.Count)
- Missing item localizations: $($missingItems.Count)
- Missing block localizations: $($missingBlocks.Count)

=== MISSING ITEM LOCALIZATIONS ($($missingItems.Count)) ===
$($missingItems -join "`n")

=== MISSING BLOCK LOCALIZATIONS ($($missingBlocks.Count)) ===
$($missingBlocks -join "`n")

=== ALL ITEM IDENTIFIERS ($($itemIds.Count)) ===
$($itemIds -join "`n")

=== ALL BLOCK IDENTIFIERS ($($blockIds.Count)) ===
$($blockIds -join "`n")
"@ | Out-File -FilePath $reportPath -Encoding UTF8

Write-Host "`nReport saved to: $reportPath" -ForegroundColor Green
Write-Host "`nFirst 20 missing items:" -ForegroundColor Cyan
$missingItems | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" }

Write-Host "`nFirst 20 missing blocks:" -ForegroundColor Cyan
$missingBlocks | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" }
