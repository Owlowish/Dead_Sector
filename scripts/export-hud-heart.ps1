param(
  [string]$SourcePath = 'docs/asset-packs/hud-gothic-v2/heart-action-source.png',
  [string]$OutputPath = 'public/assets/ui/gothic/heart-beat-v2.png'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Bitmap]::new((Resolve-Path -LiteralPath $SourcePath).Path)
$output = [System.Drawing.Bitmap]::new(128, 32, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$palette = @('#290e17', '#4d1822', '#70232a', '#93342e', '#ad4b3b', '#c76b4c') | ForEach-Object {
  [System.Drawing.ColorTranslator]::FromHtml($_)
}
$cells = @(@(0, 0), @(1, 0), @(0, 1), @(1, 1))
$cellWidth = [int]($source.Width / 2)
$cellHeight = [int]($source.Height / 2)
$frames = [System.Collections.Generic.List[object]]::new()

try {
  foreach ($cell in $cells) {
    $pixels = [System.Drawing.Color[,]]::new(32, 32)
    $minX = 32; $maxX = -1; $minY = 32
    for ($y = 0; $y -lt 32; $y++) {
      for ($x = 0; $x -lt 32; $x++) {
        $sampleX = $cell[0] * $cellWidth + [int][Math]::Floor(($x + 0.5) * $cellWidth / 32)
        $sampleY = $cell[1] * $cellHeight + [int][Math]::Floor(($y + 0.5) * $cellHeight / 32)
        $color = $source.GetPixel($sampleX, $sampleY)
        if ($color.A -lt 128) { $pixels[$x, $y] = [System.Drawing.Color]::Transparent; continue }
        $best = $palette[0]; $bestDistance = [double]::PositiveInfinity
        foreach ($candidate in $palette) {
          $distance = [Math]::Pow($color.R - $candidate.R, 2) + [Math]::Pow($color.G - $candidate.G, 2) + [Math]::Pow($color.B - $candidate.B, 2)
          if ($distance -lt $bestDistance) { $best = $candidate; $bestDistance = $distance }
        }
        $pixels[$x, $y] = $best
        $minX = [Math]::Min($minX, $x); $maxX = [Math]::Max($maxX, $x); $minY = [Math]::Min($minY, $y)
      }
    }
    if ($maxX -lt 0) { throw 'Une cellule source ne contient aucun coeur opaque.' }
    # Translation uniquement : une echelle commune conserve la contraction des lobes.
    $offsetX = 16 - [int][Math]::Floor(($minX + $maxX) / 2)
    $offsetY = 3 - $minY
    $aligned = [System.Drawing.Color[,]]::new(32, 32)
    for ($y = 0; $y -lt 32; $y++) {
      for ($x = 0; $x -lt 32; $x++) {
        $fromX = $x - $offsetX; $fromY = $y - $offsetY
        if ($fromX -ge 0 -and $fromX -lt 32 -and $fromY -ge 0 -and $fromY -lt 32) { $aligned[$x, $y] = $pixels[$fromX, $fromY] }
        else { $aligned[$x, $y] = [System.Drawing.Color]::Transparent }
      }
    }
    $frames.Add($aligned)
  }
  for ($frame = 0; $frame -lt 4; $frame++) {
    for ($y = 0; $y -lt 32; $y++) {
      for ($x = 0; $x -lt 32; $x++) {
        # Haut des vaisseaux identique : pas de scintillement ni de deplacement global.
        $color = if ($y -le 10) { $frames[0][$x, $y] } else { $frames[$frame][$x, $y] }
        $output.SetPixel($frame * 32 + $x, $y, $color)
      }
    }
  }
  $destination = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination)) | Out-Null
  $output.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output 'Heart atlas exported: 128 x 32, four anchored poses, six opaque colours.'
} finally {
  $source.Dispose(); $output.Dispose()
}
