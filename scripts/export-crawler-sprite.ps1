param(
    [Parameter(Mandatory = $true)][string]$SourceFile,
    [Parameter(Mandatory = $true)][string]$DestinationFile,
    [int]$GroundOffsetY = 0
)

# Export du canevas entier : aucun recadrage indépendant ne déplace les appuis.
Add-Type -AssemblyName System.Drawing
$sourceImage = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $SourceFile).Path)
try {
    if ($sourceImage.Width -ne $sourceImage.Height) { throw 'Le canevas source doit être carré.' }
    $targetPath = [System.IO.Path]::GetFullPath($DestinationFile)
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($targetPath)) | Out-Null
    $exportImage = New-Object System.Drawing.Bitmap(512, 512, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb))
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($exportImage)
        try {
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
            $graphics.DrawImage($sourceImage, (New-Object System.Drawing.Rectangle(0, $GroundOffsetY, 512, 512)), 0, 0, $sourceImage.Width, $sourceImage.Height, ([System.Drawing.GraphicsUnit]::Pixel))
        } finally { $graphics.Dispose() }
        $exportImage.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $exportImage.Dispose() }
} finally { $sourceImage.Dispose() }
Write-Output "Export RGBA 512x512 : $targetPath"
