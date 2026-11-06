param([string]$Workspace = (Join-Path $PSScriptRoot '..'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot = [IO.Path]::GetFullPath($Workspace)
$sourceDir = Join-Path $taskRoot 'docs/asset-packs/sources/maitre-portrait/projectiles'
$outputDir = Join-Path $taskRoot 'public/assets/zombies/portrait-projectiles'
[IO.Directory]::CreateDirectory($outputDir) | Out-Null

function Draw-Cell($graphics, $source, [Drawing.Rectangle]$destination, [Drawing.Rectangle]$crop) {
    $graphics.DrawImage($source, $destination, $crop, [Drawing.GraphicsUnit]::Pixel)
}

# Six canevas 2:1, à la même échelle. Aucun ajustement à la silhouette ni au noyau.
$flight = [Drawing.Bitmap]::new(768, 256, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
try {
    $graphics = [Drawing.Graphics]::FromImage($flight)
    try {
        $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
        $files = @('flight-base.png','flight-1.png','flight-2.png','flight-3.png','flight-4.png','flight-5.png')
        for ($i=0; $i -lt 6; $i++) {
            $source = [Drawing.Bitmap]::FromFile((Join-Path $sourceDir $files[$i]))
            try {
                if ($source.Width -ne 1774 -or $source.Height -ne 887) { throw "Canevas vol inattendu : $($files[$i])" }
                Draw-Cell $graphics $source ([Drawing.Rectangle]::new(($i%3)*256,[int][Math]::Floor($i/3)*128,256,128)) ([Drawing.Rectangle]::new(0,0,1774,887))
            } finally { $source.Dispose() }
        }
    } finally { $graphics.Dispose() }
    $flight.Save((Join-Path $outputDir 'flight.png'),[Drawing.Imaging.ImageFormat]::Png)
} finally { $flight.Dispose() }

# La planche impact garde quatre cellules carrées627px. Traductions d'appui
# uniquement : point de contact exporté(64,110), sans redimensionnement par pose.
$impact = [Drawing.Bitmap]::new(256,256,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$source = [Drawing.Bitmap]::FromFile((Join-Path $sourceDir 'impact.png'))
try {
    if ($source.Width -ne 1254 -or $source.Height -ne 1254) { throw 'Canevas impact inattendu.' }
    $graphics = [Drawing.Graphics]::FromImage($impact)
    try {
        $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
        $offsets = @(@(-2,0),@(2,0),@(0,6),@(2,6))
        for ($i=0; $i -lt 4; $i++) {
            $column=$i%2; $row=[int][Math]::Floor($i/2)
            $cell = [Drawing.Bitmap]::new(128,128,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $cellGraphics = [Drawing.Graphics]::FromImage($cell)
                try {
                    $cellGraphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
                    $cellGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
                    $cellGraphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
                    Draw-Cell $cellGraphics $source ([Drawing.Rectangle]::new($offsets[$i][0],$offsets[$i][1],128,128)) ([Drawing.Rectangle]::new($column*627,$row*627,627,627))
                } finally { $cellGraphics.Dispose() }
                Draw-Cell $graphics $cell ([Drawing.Rectangle]::new($column*128,$row*128,128,128)) ([Drawing.Rectangle]::new(0,0,128,128))
            } finally { $cell.Dispose() }
        }
    } finally { $graphics.Dispose() }
    $impact.Save((Join-Path $outputDir 'impact.png'),[Drawing.Imaging.ImageFormat]::Png)
} finally { $source.Dispose(); $impact.Dispose() }
Write-Output 'Projectiles Portrait : vol768x256(6cellules) et impact256x256(4cellules) RGBA exportés.'
