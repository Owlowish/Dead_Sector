Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\Administrateur\.gemini\antigravity\brain\11b1012c-f09d-47bb-a09e-a8bf7db9bfd2\glock_reload_gloves_spritesheet_png_1793610438546.jpg"
$destDir = "C:\Users\Administrateur\source\dead_sector\public\assets\weapons"

$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Output "Planche chargée : $($bmp.Width) x $($bmp.Height)"

$targetSize = 384
$colStarts = @(2, 347, 691, 1035)
$colWidth = 338
$rowStarts = @(2, 387)
$rowHeight = 379
$offsetX = [int](($targetSize - $colWidth) / 2) # ~23 pixels de marge

for ($r = 0; $r -lt 2; $r++) {
    for ($c = 0; $c -lt 4; $c++) {
        $frameIndex = $r * 4 + $c
        $frameBmp = New-Object System.Drawing.Bitmap($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

        $srcStartX = $colStarts[$c]
        $srcStartY = $rowStarts[$r]

        for ($y = 0; $y -lt $rowHeight; $y++) {
            $destY = $targetSize - $rowHeight + $y # Aligner au bas de l'image (y = 5 à 383)
            for ($x = 0; $x -lt $colWidth; $x++) {
                $destX = $offsetX + $x
                $pixel = $bmp.GetPixel($srcStartX + $x, $srcStartY + $y)

                # Test chroma key magenta
                $isMagenta = ($pixel.R -gt 130) -and ($pixel.B -gt 130) -and ($pixel.G -lt 110) -and (($pixel.R - $pixel.G) -gt 45) -and (($pixel.B - $pixel.G) -gt 45)

                # Filtrer les bordures de cellule parasites
                $nearBorder = ($x -lt 2) -or ($x -ge ($colWidth - 2)) -or ($y -lt 2)
                $isBorderArtifact = $nearBorder -and ($pixel.R -lt 70) -and ($pixel.G -lt 70) -and ($pixel.B -lt 70)

                if ($isMagenta -or $isBorderArtifact) {
                    $frameBmp.SetPixel($destX, $destY, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
                } else {
                    $red = $pixel.R
                    $green = $pixel.G
                    $blue = $pixel.B

                    # De-fringing : si un pixel sombre a une frange magenta de compression jpeg
                    if (($red -gt $green + 25) -and ($blue -gt $green + 25) -and ($green -lt 90)) {
                        $avgDark = [int][Math]::Min($green, 25)
                        $frameBmp.SetPixel($destX, $destY, [System.Drawing.Color]::FromArgb(255, $avgDark, $avgDark, $avgDark))
                    } else {
                        $frameBmp.SetPixel($destX, $destY, [System.Drawing.Color]::FromArgb(255, $red, $green, $blue))
                    }
                }
            }
        }

        # Remplir les marges latérales et le haut restant en transparent
        for ($y = 0; $y -lt $targetSize; $y++) {
            for ($x = 0; $x -lt $offsetX; $x++) {
                $frameBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
            for ($x = ($offsetX + $colWidth); $x -lt $targetSize; $x++) {
                $frameBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
        }
        for ($y = 0; $y -lt ($targetSize - $rowHeight); $y++) {
            for ($x = 0; $x -lt $targetSize; $x++) {
                $frameBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
        }

        $outPath = Join-Path $destDir "pistol_reload_$frameIndex.png"
        $frameBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Output "Frame $frameIndex -> $outPath"

        if ($frameIndex -eq 0) {
            $csPath = Join-Path $destDir "modern_hip_cs.png"
            $frameBmp.Save($csPath, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Output "Copie repos modern_hip_cs.png"
        }

        $frameBmp.Dispose()
    }
}

$bmp.Dispose()
Write-Output "Découpage terminé avec succès !"