param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][ValidateSet('wall','wood')][string]$Surface)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$width = if ($Surface -eq 'wall') {384} else {512}
$height = if ($Surface -eq 'wall') {768} else {512}
$output = Join-Path $root "public/assets/textures/mansion/salon-$Surface-v1.png"
$inputImage = [Drawing.Bitmap]::new($Source)
$bitmap = [Drawing.Bitmap]::new($width,$height,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
  $graphics.DrawImage($inputImage,[Drawing.Rectangle]::new(0,0,$width,$height),0,0,$inputImage.Width,$inputImage.Height,[Drawing.GraphicsUnit]::Pixel)
  $bitmap.Save($output,[Drawing.Imaging.ImageFormat]::Png)
  Write-Output "$Surface : $($inputImage.Width)x$($inputImage.Height) -> ${width}x${height} : $output"
} finally { $graphics.Dispose(); $bitmap.Dispose(); $inputImage.Dispose() }
