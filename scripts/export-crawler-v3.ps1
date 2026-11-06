param(
    [string]$SourceDir = 'docs/asset-packs/sources/rampeuse-v3',
    [string]$DestinationDir = 'public/assets/zombies/crawler'
)

# Même réduction du canevas entier pour les six poses ; seules les translations
# verticales compensent la ligne d'appui dessinée. Aucun recadrage par silhouette.
$offsets = [ordered]@{ idle = -2; 'crawl-a' = -3; 'crawl-b' = -3; attack = 0; hurt = -2; death = -7 }
foreach ($pose in $offsets.Keys) {
    & (Join-Path $PSScriptRoot 'export-crawler-sprite.ps1') `
        -SourceFile (Join-Path $SourceDir "$pose-source.png") `
        -DestinationFile (Join-Path $DestinationDir "$pose.png") `
        -GroundOffsetY $offsets[$pose]
}
