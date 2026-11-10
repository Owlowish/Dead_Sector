$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$axeRoot = Split-Path -Parent $PSScriptRoot
$axeSourceDir = Join-Path $axeRoot 'docs/asset-packs/sources/axe'
$axeExports = @(
  @{ Source = 'diagonal-guard-left-hand-source.png'; Target = 'idle.png'; OffsetX = 0; GripSource = 'diagonal-guard-reference-grip-source.png'; GripRect = @(0, 274, 122, 110) },
  @{ Source = 'vertical-windup-source.png'; Target = 'windup.png'; OffsetX = 0 },
  @{ Source = 'vertical-contact-source.png'; Target = 'contact.png'; OffsetX = 4 },
  @{ Source = 'diagonal-lift-left-hand-source.png'; Target = 'lift.png'; OffsetX = 0; GripSource = 'diagonal-lift-reference-grip-source.png'; GripRect = @(72, 244, 114, 140) },
  @{ Source = 'overhead-overscan-source.png'; Target = 'overhead.png'; OffsetX = 0; Height = 576; HeadX = -6; HeadY = 142; BodyY = 254; MirrorY = 260; ShaftX = 204.5; ShaftSlope = 0 },
  @{ Source = 'overhead-action-source.png'; Target = 'chop.png'; OffsetX = 0; CellX = 0; CellY = 1; MirrorY = 177; ShaftX = 199; ShaftSlope = 0.06 },
  @{ Source = 'overhead-action-source.png'; Target = 'impact.png'; OffsetX = 0; CellX = 1; CellY = 1; MirrorY = 259; ShaftX = 189.5; ShaftSlope = 0.15; BladeTipY = 266 }
)
foreach ($axeExport in $axeExports) {
  $axeSource = Join-Path $axeSourceDir $axeExport.Source
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
        # Export des poses à l'échelle native.
        if ($axeExport.ContainsKey('CellX')) {
          $axeGraphics.DrawImage($axeImage, [System.Drawing.Rectangle]::new(0, 0, 384, 384), [System.Drawing.Rectangle]::new(627 * $axeExport.CellX, 627 * $axeExport.CellY, 627, 627), [System.Drawing.GraphicsUnit]::Pixel)
        } else {
          $axeGraphics.DrawImage($axeImage, [System.Drawing.Rectangle]::new($axeExport.OffsetX, 0, 384, $axeHeight))
        }
        if ($axeExport.ContainsKey('GripSource')) {
          # Remplacer seulement la prise gauche et sa manche ; conserver le fer et les ancrages.
          $axeGrip = [System.Drawing.Image]::FromFile((Join-Path $axeSourceDir $axeExport.GripSource))
          try {
            if ($axeGrip.Width -ne $axeImage.Width -or $axeGrip.Height -ne $axeImage.Height) { throw 'Dimensions source de la prise inattendues.' }
            $gripRect = $axeExport.GripRect
            $gripScale = $axeGrip.Width / 384
            $axeGraphics.DrawImage($axeGrip,
              [System.Drawing.RectangleF]::new($gripRect[0], $gripRect[1], $gripRect[2], $gripRect[3]),
              [System.Drawing.RectangleF]::new($gripRect[0] * $gripScale, $gripRect[1] * $gripScale, $gripRect[2] * $gripScale, $gripRect[3] * $gripScale),
              [System.Drawing.GraphicsUnit]::Pixel)
          } finally { $axeGrip.Dispose() }
        }
        if ($axeExport.ContainsKey('HeadY')) {
          # Même fer aux deux poses. On garde les prises et les manches de la base par-dessus.
          $axeBodyRect = [System.Drawing.Rectangle]::new(0, $axeExport.BodyY, 384, $axeHeight - $axeExport.BodyY)
          $axeBody = $axeBitmap.Clone($axeBodyRect, $axeBitmap.PixelFormat)
          $axeHead = [System.Drawing.Image]::FromFile((Join-Path $axeSourceDir 'guard-three-quarter-source.png'))
          try {
            if ($axeHead.Width -ne 1254 -or $axeHead.Height -ne 1254) { throw 'Dimensions source du fer inattendues.' }
            $axeGraphics.Clear([System.Drawing.Color]::Transparent)
            $axeGraphics.DrawImage($axeHead,
              [System.Drawing.RectangleF]::new(144 + $axeExport.HeadX, $axeExport.HeadY, 112, 126),
              [System.Drawing.RectangleF]::new(144 * 1254 / 384, 0, 112 * 1254 / 384, 126 * 1254 / 384),
              [System.Drawing.GraphicsUnit]::Pixel)
            $axeGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
            $axeGraphics.DrawImage($axeBody, $axeBodyRect, [System.Drawing.Rectangle]::new(0, 0, 384, $axeBody.Height),
              [System.Drawing.GraphicsUnit]::Pixel)
          } finally {
            $axeHead.Dispose()
            $axeBody.Dispose()
          }
        }
      } finally { $axeGraphics.Dispose() }
      # Réfléchir les prises des anciennes poses autour du manche, sans retourner le fer.
      $axeMirror = if ($axeExport.ContainsKey('MirrorY')) { $axeBitmap.Clone() }
      try {
        for ($axeY = 0; $axeY -lt $axeHeight; $axeY++) {
          $mirrorRow = $null -ne $axeMirror -and $axeY -ge $axeExport.MirrorY
          $axisTwice = if ($mirrorRow) { [int][Math]::Round(2 * ($axeExport.ShaftX + $axeExport.ShaftSlope * ($axeY - $axeExport.MirrorY))) }
          $hasBladeTip = $mirrorRow -and $axeExport.ContainsKey('BladeTipY') -and $axeY -le $axeExport.BladeTipY
          for ($axeX = 0; $axeX -lt 384; $axeX++) {
            $axePixel = $axeBitmap.GetPixel($axeX, $axeY)
            if ($mirrorRow -and -not ($hasBladeTip -and $axeX -lt 178 -and $axePixel.A -ge 128)) {
              $fromX = $axisTwice - $axeX
              $axePixel = if ($fromX -lt 0 -or $fromX -ge 384 -or ($hasBladeTip -and $fromX -lt 178)) {
                [System.Drawing.Color]::Transparent
              } else { $axeMirror.GetPixel($fromX, $axeY) }
            }
            if ($axePixel.A -lt 128) { $axeBitmap.SetPixel($axeX, $axeY, [System.Drawing.Color]::Transparent) }
            else { $axeBitmap.SetPixel($axeX, $axeY, [System.Drawing.Color]::FromArgb(255, $axePixel.R, $axePixel.G, $axePixel.B)) }
          }
        }
      } finally { if ($axeMirror) { $axeMirror.Dispose() } }
      $axeBitmap.Save($axeTarget, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output $axeTarget
    } finally { $axeBitmap.Dispose() }
  } finally { $axeImage.Dispose() }
}
