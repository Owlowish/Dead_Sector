param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][ValidateSet('base','cycle')][string]$Mode,
  [ValidateRange(0.01,1.0)][double]$CycleScale = 1,
  [Nullable[int]]$RootRow = $null
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$width = if ($Mode -eq 'base') {128} else {512}
$height = if ($Mode -eq 'base') {128} else {256}
$target = if ($Mode -eq 'base') {'docs/asset-packs/hearth-fire-v1/base.png'} else {'public/assets/effects/hearth-fire-v1.png'}
$output = Join-Path $root $target
[IO.Directory]::CreateDirectory((Split-Path -Parent $output)) | Out-Null
$inputImage = [Drawing.Bitmap]::new($Source)
$bitmap = [Drawing.Bitmap]::new($width,$height,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [Drawing.Graphics]::FromImage($bitmap)

function Get-AlphaBounds([Drawing.Bitmap]$Image, [byte]$MinimumAlpha) {
  $left = $Image.Width; $top = $Image.Height; $right = -1; $bottom = -1
  for ($pixelY = 0; $pixelY -lt $Image.Height; $pixelY++) {
    for ($pixelX = 0; $pixelX -lt $Image.Width; $pixelX++) {
      if ($Image.GetPixel($pixelX, $pixelY).A -lt $MinimumAlpha) { continue }
      $left = [Math]::Min($left, $pixelX); $top = [Math]::Min($top, $pixelY)
      $right = [Math]::Max($right, $pixelX); $bottom = [Math]::Max($bottom, $pixelY)
    }
  }
  if ($right -lt 0) { throw 'Cellule alpha vide.' }
  return [Drawing.Rectangle]::new($left, $top, $right - $left + 1, $bottom - $top + 1)
}

try {
  $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
  if ($Mode -eq 'cycle' -and ($CycleScale -ne 1 -or $null -ne $RootRow)) {
    if ([Math]::Abs($inputImage.Width / $inputImage.Height - 2) -gt 0.001) {
      throw 'Atlas 4 x 2 a cellules carrees attendu (ratio 2:1).'
    }
    if ($null -ne $RootRow -and ($RootRow -lt 0 -or $RootRow -ge 128)) {
      throw 'RootRow doit etre compris entre 0 et 127.'
    }
    $graphics.Clear([Drawing.Color]::Transparent)
    $cellSize = 128.0
    $scaledSize = $cellSize * $CycleScale
    $margin = ($cellSize - $scaledSize) / 2
    for ($frame = 0; $frame -lt 8; $frame++) {
      $column = $frame % 4; $row = [int][Math]::Floor($frame / 4)
      $tile = [Drawing.Bitmap]::new(128,128,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $tileGraphics = [Drawing.Graphics]::FromImage($tile)
      try {
        $tileGraphics.Clear([Drawing.Color]::Transparent)
        $tileGraphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
        $tileGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $tileGraphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
        # Meme echelle et meme cadrage pour les huit cellules, y compris aux bords fractionnaires.
        $tileGraphics.DrawImage($inputImage,
          [Drawing.RectangleF]::new($margin,$margin,$scaledSize,$scaledSize),
          [Drawing.RectangleF]::new($column * $inputImage.Width / 4, $row * $inputImage.Height / 2,
            $inputImage.Width / 4, $inputImage.Height / 2), [Drawing.GraphicsUnit]::Pixel)
        $bounds = Get-AlphaBounds $tile 13
        $translationY = if ($null -ne $RootRow) { [int]$RootRow - ($bounds.Bottom - 1) } else { 0 }
        # Garder egalement les pixels faiblement transparents ; aucune silhouette n'est tronquee.
        $allAlpha = Get-AlphaBounds $tile 1
        if ($allAlpha.Top + $translationY -lt 0 -or $allAlpha.Bottom + $translationY -gt 128) {
          throw "Translation de la pose $frame tronquant l'alpha."
        }
        $graphics.DrawImageUnscaled($tile, $column * 128, $row * 128 + $translationY)
        Write-Output "pose $frame : echelle commune=$CycleScale ; racine avant=$($bounds.Bottom - 1) ; translationY=$translationY"
      } finally { $tileGraphics.Dispose(); $tile.Dispose() }
    }
  } else {
    $graphics.DrawImage($inputImage,[Drawing.Rectangle]::new(0,0,$width,$height),0,0,$inputImage.Width,$inputImage.Height,[Drawing.GraphicsUnit]::Pixel)
  }
  $bitmap.Save($output,[Drawing.Imaging.ImageFormat]::Png)
  Write-Output "$Mode : $($inputImage.Width)x$($inputImage.Height) -> ${width}x${height} : $output"
} finally { $graphics.Dispose(); $bitmap.Dispose(); $inputImage.Dispose() }
