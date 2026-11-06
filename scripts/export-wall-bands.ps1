param([string]$PaperSource = "$PSScriptRoot/../docs/asset-packs/wall-bands-v1/source-paper.png")
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$folder = Join-Path $root 'docs/asset-packs/wall-bands-v1'
[IO.Directory]::CreateDirectory($folder) | Out-Null
$paper = [Drawing.Bitmap]::new($PaperSource)
$wood = [Drawing.Bitmap]::new((Join-Path $root 'public/assets/textures/mansion/salon-wall-v1.png'))
$atlas = [Drawing.Bitmap]::new(256,512,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
function Export-Region($Source,$Region,[string]$Path) {
  $bitmap = [Drawing.Bitmap]::new(256,256,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.DrawImage($Source,[Drawing.Rectangle]::new(0,0,256,256),$Region,[Drawing.GraphicsUnit]::Pixel)
    $bitmap.Save($Path,[Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
try {
  Export-Region $paper ([Drawing.Rectangle]::new(0,0,$paper.Width,$paper.Height)) (Join-Path $folder 'paper.png')
  Export-Region $wood ([Drawing.Rectangle]::new(0,468,384,300)) (Join-Path $folder 'wainscot.png')
  $tile = [Drawing.Bitmap]::new((Join-Path $folder 'paper.png'))
  $paving = [Drawing.Bitmap]::new(768,768,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $previewGraphics = [Drawing.Graphics]::FromImage($paving)
  try {
    for ($row=0; $row -lt 3; $row++) {
      for ($column=0; $column -lt 3; $column++) { $previewGraphics.DrawImageUnscaled($tile,256*$column,256*$row) }
    }
    $paving.Save((Join-Path $folder 'paper-tiling.png'),[Drawing.Imaging.ImageFormat]::Png)
  } finally { $previewGraphics.Dispose(); $paving.Dispose(); $tile.Dispose() }
  $graphics = [Drawing.Graphics]::FromImage($atlas)
  try {
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.DrawImage($paper,[Drawing.Rectangle]::new(0,4,256,248),0,0,$paper.Width,$paper.Height,[Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawImage($wood,[Drawing.Rectangle]::new(0,260,256,248),0,468,384,300,[Drawing.GraphicsUnit]::Pixel)
  } finally { $graphics.Dispose() }
  # Rangées de garde : répéter le bord du module sans modifier le dessin source.
  foreach($pair in @(@(0,4),@(252,251),@(256,260),@(508,507))) {
    for($row=0;$row -lt 4;$row++) {
      for($x=0;$x -lt 256;$x++) { $atlas.SetPixel($x,$pair[0]+$row,$atlas.GetPixel($x,$pair[1])) }
    }
  }
  $target = Join-Path $root 'public/assets/textures/mansion/wall-bands-v1.png'
  $atlas.Save($target,[Drawing.Imaging.ImageFormat]::Png)
  Write-Output "Atlas : 256x512 ; papier source $($paper.Width)x$($paper.Height), bois source384x300 ; $target"
} finally { $paper.Dispose(); $wood.Dispose(); $atlas.Dispose() }
