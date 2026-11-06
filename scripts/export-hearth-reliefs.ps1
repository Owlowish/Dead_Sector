param([string]$Source = (Join-Path $PSScriptRoot '../docs/asset-packs/hearth-fire-v1/reliefs-source.png'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$output = Join-Path $projectRoot 'public/assets/textures/mansion/hearth-reliefs-v1.png'
[IO.Directory]::CreateDirectory((Split-Path -Parent $output)) | Out-Null
$inputImage = [Drawing.Bitmap]::new((Resolve-Path -LiteralPath $Source).Path)
$bitmap = [Drawing.Bitmap]::new(512, 512, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [Drawing.Graphics]::FromImage($bitmap)

function Get-AlphaBounds([Drawing.Rectangle]$Region) {
  $left = $Region.Right; $top = $Region.Bottom; $right = -1; $bottom = -1
  for ($pixelY = $Region.Top; $pixelY -lt $Region.Bottom; $pixelY++) {
    for ($pixelX = $Region.Left; $pixelX -lt $Region.Right; $pixelX++) {
      if ($inputImage.GetPixel($pixelX, $pixelY).A -eq 0) { continue }
      $left = [Math]::Min($left, $pixelX); $top = [Math]::Min($top, $pixelY)
      $right = [Math]::Max($right, $pixelX); $bottom = [Math]::Max($bottom, $pixelY)
    }
  }
  if ($right -lt 0) { throw "Region alpha vide : $Region" }
  return [Drawing.Rectangle]::new($left, $top, $right - $left + 1, $bottom - $top + 1)
}

try {
  if ($inputImage.Width -ne 1254 -or $inputImage.Height -ne 1254) {
    throw 'Source 1254 x 1254 attendue ; les regions de ce lot sont fixes.'
  }
  $graphics.Clear([Drawing.Color]::Transparent)
  $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
  $cells = @(
    @{ Name = 'cartouche'; Region = [Drawing.Rectangle]::new(0, 0, 1254, 540); Cell = [Drawing.Rectangle]::new(0, 0, 512, 256) },
    @{ Name = 'lion'; Region = [Drawing.Rectangle]::new(0, 540, 627, 714); Cell = [Drawing.Rectangle]::new(0, 256, 256, 256) },
    @{ Name = 'clock'; Region = [Drawing.Rectangle]::new(627, 540, 627, 714); Cell = [Drawing.Rectangle]::new(256, 256, 256, 256) }
  )
  foreach ($item in $cells) {
    $bounds = Get-AlphaBounds $item.Region
    $cell = $item.Cell
    $scale = [Math]::Min(($cell.Width - 16) / $bounds.Width, ($cell.Height - 16) / $bounds.Height)
    $targetWidth = [int][Math]::Floor($bounds.Width * $scale)
    $targetHeight = [int][Math]::Floor($bounds.Height * $scale)
    $target = [Drawing.Rectangle]::new(
      $cell.X + [int][Math]::Floor(($cell.Width - $targetWidth) / 2),
      $cell.Y + [int][Math]::Floor(($cell.Height - $targetHeight) / 2),
      $targetWidth, $targetHeight
    )
    $graphics.DrawImage($inputImage, $target, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height, [Drawing.GraphicsUnit]::Pixel)
    Write-Output "$($item.Name) : source=$bounds ; export=$target ; nearest-neighbor, alpha conserve"
  }
  $bitmap.Save($output, [Drawing.Imaging.ImageFormat]::Png)
  Write-Output "Atlas 512 x 512 : $output"
} finally {
  $graphics.Dispose(); $bitmap.Dispose(); $inputImage.Dispose()
}
