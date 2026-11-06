$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$axeRoot = Split-Path -Parent $PSScriptRoot
$axeExports = @(
  @{ Source = 'vertical-idle-upright-source.png'; Target = 'idle.png'; OffsetX = 0 },
  @{ Source = 'vertical-windup-source.png'; Target = 'windup.png'; OffsetX = 0 },
  @{ Source = 'vertical-contact-source.png'; Target = 'contact.png'; OffsetX = 4 },
  @{ Source = 'overhead-lift-upright-source.png'; Target = 'lift.png'; OffsetX = 0 },
  @{ Source = 'overhead-overscan-source.png'; Target = 'overhead.png'; OffsetX = 0; Height = 576 },
  @{ Source = 'overhead-action-source.png'; Target = 'chop.png'; OffsetX = 0; CellX = 0; CellY = 1 },
  @{ Source = 'overhead-action-source.png'; Target = 'impact.png'; OffsetX = 0; CellX = 1; CellY = 1 }
)
foreach ($axeExport in $axeExports) {
  $axeSource = Join-Path $axeRoot ('docs/asset-packs/sources/axe/' + $axeExport.Source)
  $axeTarget = Join-Path $axeRoot ('public/assets/weapons/axe/' + $axeExport.Target)
  $axeImage = [System.Drawing.Image]::FromFile($axeSource)
  try {
    $axeHeight = if ($axeExport.ContainsKey('Height')) { $axeExport.Height } else { 384 }
    if ([Math]::Abs($axeImage.Width / $axeImage.Height - 384 / $axeHeight) -gt 0.002) { throw "Unexpected source ratio: $axeSource" }
    $axeBitmap = [System.Drawing.Bitmap]::new(384, $axeHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $axeGraphics = [System.Drawing.Graphics]::FromImage($axeBitmap)
      try {
        $axeGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $axeGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $axeGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        # Calage du manche sur le même axe x=209,5 px, sans déformer les poses.
        if ($axeExport.ContainsKey('CellX')) {
          $axeGraphics.DrawImage($axeImage, [System.Drawing.Rectangle]::new(0, 0, 384, 384), [System.Drawing.Rectangle]::new(627 * $axeExport.CellX, 627 * $axeExport.CellY, 627, 627), [System.Drawing.GraphicsUnit]::Pixel)
        } else {
          $axeGraphics.DrawImage($axeImage, [System.Drawing.Rectangle]::new($axeExport.OffsetX, 0, 384, $axeHeight))
        }
      } finally { $axeGraphics.Dispose() }
      for ($axeY = 0; $axeY -lt $axeHeight; $axeY++) {
        for ($axeX = 0; $axeX -lt 384; $axeX++) {
          $axePixel = $axeBitmap.GetPixel($axeX, $axeY)
          if ($axePixel.A -lt 128) { $axeBitmap.SetPixel($axeX, $axeY, [System.Drawing.Color]::Transparent) }
          else { $axeBitmap.SetPixel($axeX, $axeY, [System.Drawing.Color]::FromArgb(255, $axePixel.R, $axePixel.G, $axePixel.B)) }
        }
      }
      $axeBitmap.Save($axeTarget, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output $axeTarget
    } finally { $axeBitmap.Dispose() }
  } finally { $axeImage.Dispose() }
}
