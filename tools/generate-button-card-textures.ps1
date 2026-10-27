param([switch]$TabTopOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$catalog = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'colors.txt')
$assetRoot = Join-Path $projectRoot 'RP/textures/ui/button_card'
[void](New-Item -ItemType Directory -Force -Path $assetRoot)

# New pixel grids, not recolored copies of Minecraft/UtilityCraft assets.
# Rounded top corners and a straight bottom edge fit above a machine panel.
$cardPixels = @(
    '..OOOOOO..', '.OLLLLLSO.', 'OLLFFFFSSO',
    'OLFFFFFFSO', 'OLFFFFFFSO', 'OLFFFFFFSO',
    'OLFFFFFFSO', 'OLFFFFFFSO', 'OSSSSSSSSO'
)
$buttonPixels = @('OOOOO', 'OLLLO', 'OLFSO', 'OSSSO', 'OOOOO')
# Same 12x11 silhouette and four-pixel nine-slice as TabTopBackRightMostDark.
# The transparent lower-left section lets the machine panel cover the tab foot.
$tabTopPixels = @(
    '..OOOOOOO...', '.OLLLLLLLO..', 'OLLLLLLLLFO.',
    'OLLLFFFFFSSO', 'OLLFFFFFFSSO', 'OLLFFFFFFSSO',
    'OLLFFFFFFSSO', '.........SSO', '..........SO',
    '...........O', '............'
)

function Write-Texture($name, $pixels, $palette, $slice) {
    $bitmap = [System.Drawing.Bitmap]::new($pixels[0].Length, $pixels.Count)
    try {
        for ($y = 0; $y -lt $pixels.Count; $y++) {
            for ($x = 0; $x -lt $pixels[0].Length; $x++) {
                $symbol = $pixels[$y][$x].ToString()
                $color = if ($symbol -eq '.') { [System.Drawing.Color]::Transparent } else { $palette[$symbol] }
                $bitmap.SetPixel($x, $y, $color)
            }
        }
        $bitmap.Save((Join-Path $assetRoot "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $metadata = @{ nineslice_size = $slice; base_size = @($bitmap.Width, $bitmap.Height) }
        Set-Content -LiteralPath (Join-Path $assetRoot "$name.json") -Value ($metadata | ConvertTo-Json) -Encoding utf8
    }
    finally { $bitmap.Dispose() }
}

$sections = [regex]::Matches($catalog, '(?ms)^\[(background_panel(?:_[a-z_]+)?)\]\r?\n(.*?)(?=^\[|^===|\z)')
$count = 0
foreach ($section in $sections) {
    $name = $section.Groups[1].Value -replace '^background_panel_?', ''
    if ($name -eq '') { $name = 'default' }
    $body = $section.Groups[2].Value
    $palette = @{}
    foreach ($entry in @{ F = 'Preenchimento'; O = 'Contorno externo'; L = 'Borda superior/esquerda'; S = 'Borda inferior/direita' }.GetEnumerator()) {
        $match = [regex]::Match($body, [regex]::Escape($entry.Value) + ':.*?#([0-9A-Fa-f]{6})')
        if (-not $match.Success) { throw "Missing $($entry.Value) in $name" }
        $palette[$entry.Key] = [System.Drawing.ColorTranslator]::FromHtml('#' + $match.Groups[1].Value)
    }
    Write-Texture "tab_top_$name" $tabTopPixels $palette 4
    if ($TabTopOnly) { $count++; continue }
    Write-Texture "background_$name" $cardPixels $palette 4
    Write-Texture "button_$name" $buttonPixels $palette 2
    $pressed = @{ F = $palette.F; O = $palette.O; L = $palette.S; S = $palette.L }
    Write-Texture "button_${name}_pressed" $buttonPixels $pressed 2
    $fill = $palette.F
    $hoverFill = [System.Drawing.Color]::FromArgb(255, [Math]::Min(255, $fill.R + 20), [Math]::Min(255, $fill.G + 20), [Math]::Min(255, $fill.B + 20))
    $hover = @{ F = $hoverFill; O = $palette.O; L = $palette.L; S = $palette.S }
    Write-Texture "button_${name}_hover" $buttonPixels $hover 2
    $hoverPressed = @{ F = $hoverFill; O = $palette.O; L = $palette.S; S = $palette.L }
    Write-Texture "button_${name}_pressed_hover" $buttonPixels $hoverPressed 2
    $count++
}
if ($count -ne 18) { throw "Expected 18 panel palettes (default plus 17 colors); generated $count" }
Write-Output "Generated $count tab-top palettes. Existing button states are preserved with -TabTopOnly."
