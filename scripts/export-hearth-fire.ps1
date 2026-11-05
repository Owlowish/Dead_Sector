param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][ValidateSet('base','cycle')][string]$Mode)
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
try {
  $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
  $graphics.DrawImage($inputImage,[Drawing.Rectangle]::new(0,0,$width,$height),0,0,$inputImage.Width,$inputImage.Height,[Drawing.GraphicsUnit]::Pixel)
  $bitmap.Save($output,[Drawing.Imaging.ImageFormat]::Png)
  Write-Output "$Mode : $($inputImage.Width)x$($inputImage.Height) -> ${width}x${height} : $output"
} finally { $graphics.Dispose(); $bitmap.Dispose(); $inputImage.Dispose() }
