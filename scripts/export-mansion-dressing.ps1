param(
  [string]$PackPath = 'docs/asset-packs/DECOR_MANOIR_2026-11-05.json',
  [string]$OnlyAsset = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$packFile = Join-Path $projectRoot $PackPath
$pack = Get-Content -LiteralPath $packFile -Raw | ConvertFrom-Json

function Get-AlphaBounds([Drawing.Bitmap]$Bitmap) {
  $rect = [Drawing.Rectangle]::new(0, 0, $Bitmap.Width, $Bitmap.Height)
  $data = $Bitmap.LockBits($rect, [Drawing.Imaging.ImageLockMode]::ReadOnly, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $pixels = [byte[]]::new($data.Stride * $Bitmap.Height)
    [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $pixels.Length)
    $minX = $Bitmap.Width; $minY = $Bitmap.Height; $maxX = -1; $maxY = -1
    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
      for ($x = 0; $x -lt $Bitmap.Width; $x++) {
        if ($pixels[$y * $data.Stride + $x * 4 + 3] -lt 128) { continue }
        $minX = [Math]::Min($minX, $x); $minY = [Math]::Min($minY, $y)
        $maxX = [Math]::Max($maxX, $x); $maxY = [Math]::Max($maxY, $y)
      }
    }
    if ($maxX -lt 0) { throw 'Image sans silhouette alpha visible.' }
    return [Drawing.Rectangle]::new($minX, $minY, $maxX - $minX + 1, $maxY - $minY + 1)
  } finally { $Bitmap.UnlockBits($data) }
}

function Resolve-Output([string]$RelativePath) {
  $absolute = [IO.Path]::GetFullPath((Join-Path $projectRoot $RelativePath))
  if (-not $absolute.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'La sortie doit rester dans le projet.'
  }
  [IO.Directory]::CreateDirectory((Split-Path -Parent $absolute)) | Out-Null
  return $absolute
}

function Set-CutoutAlpha([Drawing.Bitmap]$Bitmap) {
  $rect = [Drawing.Rectangle]::new(0, 0, $Bitmap.Width, $Bitmap.Height)
  $data = $Bitmap.LockBits($rect, [Drawing.Imaging.ImageLockMode]::ReadWrite, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $pixels = [byte[]]::new($data.Stride * $Bitmap.Height)
    [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $pixels.Length)
    for ($i = 0; $i -lt $pixels.Length; $i += 4) {
      if ($pixels[$i + 3] -lt 128) {
        $pixels[$i] = 0; $pixels[$i + 1] = 0; $pixels[$i + 2] = 0; $pixels[$i + 3] = 0
      } else { $pixels[$i + 3] = 255 }
    }
    [Runtime.InteropServices.Marshal]::Copy($pixels, 0, $data.Scan0, $pixels.Length)
  } finally { $Bitmap.UnlockBits($data) }
}

foreach ($asset in $pack.assets) {
  if ($OnlyAsset -and $asset.id -ne $OnlyAsset) { continue }
  if (-not $asset.sourceFile -or -not (Test-Path -LiteralPath $asset.sourceFile)) { continue }
  $source = [Drawing.Bitmap]::new($asset.sourceFile)
  $export = [Drawing.Bitmap]::new(256, 512, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $bounds = Get-AlphaBounds $source
    $scale = [Math]::Min(240.0 / $bounds.Width, 480.0 / $bounds.Height)
    $width = [int][Math]::Floor($bounds.Width * $scale)
    $height = [int][Math]::Floor($bounds.Height * $scale)
    $destination = [Drawing.Rectangle]::new([int][Math]::Floor((256 - $width) / 2), [int][Math]::Floor((512 - $height) / 2), $width, $height)
    $graphics = [Drawing.Graphics]::FromImage($export)
    try {
      $graphics.Clear([Drawing.Color]::Transparent)
      $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
      $graphics.DrawImage($source, $destination, $bounds, [Drawing.GraphicsUnit]::Pixel)
    } finally { $graphics.Dispose() }
    # Même découpe que alphaTest=0.5 : supprimer les alpha inutiles allège les PNG.
    Set-CutoutAlpha $export
    $output = Resolve-Output $asset.plannedFile
    $export.Save($output, [Drawing.Imaging.ImageFormat]::Png)
    $exportBounds = Get-AlphaBounds $export
    $asset.exportFile = $asset.plannedFile
    $asset.measuredDimensions = @{ source = @($source.Width, $source.Height); export = @(256, 512); alphaBounds = @{ x = $exportBounds.X; y = $exportBounds.Y; width = $exportBounds.Width; height = $exportBounds.Height } }
    $asset.transformations = @('Cadrage sur les pixels alpha >=128, sans supprimer une couleur', 'Réduction NearestNeighbor proportionnelle vers 240×480 maximum', 'Centrage dans 256×512 avec marges transparentes', 'Découpe alphaTest 0.5 préappliquée ; pixels écartés mis à RGBA zéro')
    $asset.validation.file = 'pass'
    Write-Output ($asset.id + ': 256x512, ' + (Get-Item -LiteralPath $output).Length + ' octets')
  } finally { $export.Dispose(); $source.Dispose() }
}

$missing = @($pack.assets | Where-Object { -not $_.exportFile -or -not (Test-Path -LiteralPath (Join-Path $projectRoot $_.exportFile)) })
if ($missing.Count -eq 0) {
  $atlas = [Drawing.Bitmap]::new(1024, 1024, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [Drawing.Graphics]::FromImage($atlas)
    try {
      $graphics.Clear([Drawing.Color]::Transparent)
      $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
      foreach ($asset in $pack.assets) {
        $cell = [Drawing.Bitmap]::new((Join-Path $projectRoot $asset.exportFile))
        try { $graphics.DrawImageUnscaled($cell, [int]$asset.atlasCell.x, [int]$asset.atlasCell.y) } finally { $cell.Dispose() }
      }
    } finally { $graphics.Dispose() }
    $atlasFile = Resolve-Output 'public/assets/decor/mansion-details-v1.png'
    $atlas.Save($atlasFile, [Drawing.Imaging.ImageFormat]::Png)
    Write-Output ('Atlas: 1024x1024, ' + (Get-Item -LiteralPath $atlasFile).Length + ' octets')
  } finally { $atlas.Dispose() }
}
$pack.handoff.missingRequiredAssets = @($missing | ForEach-Object id)
$pack | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $packFile -Encoding utf8
