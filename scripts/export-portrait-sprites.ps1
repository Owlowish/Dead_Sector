param([string]$Workspace = (Join-Path $PSScriptRoot '..'))
$ErrorActionPreference = 'Stop'

# Les cellules conservent leur échelle commune ; aucun ajustement à la silhouette.
# Le débord fixe par planche récupère les doigts dépassant les cases sources.
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
public static class PortraitAlpha {
  public static void KeepBody(Bitmap image) {
    int w=image.Width,h=image.Height,n=w*h; var mask=new bool[n]; var labels=new int[n];
    for(int y=0;y<h;y++) for(int x=0;x<w;x++) mask[y*w+x]=image.GetPixel(x,y).A>102;
    int id=0,best=0,bestCount=0; var queue=new int[n];
    for(int start=0;start<n;start++) {
      if(!mask[start]||labels[start]!=0) continue;
      id++; int read=0,count=1;queue[0]=start;labels[start]=id;
      while(read<count) {
        int at=queue[read++],x=at%w,y=at/w;
        foreach(int next in new[]{x>0?at-1:-1,x<w-1?at+1:-1,y>0?at-w:-1,y<h-1?at+w:-1}) {
          if(next<0||!mask[next]||labels[next]!=0)continue;
          labels[next]=id;queue[count++]=next;
        }
      }
      if(count>bestCount){best=id;bestCount=count;}
    }
    for(int y=0;y<h;y++) for(int x=0;x<w;x++) {
      var c=image.GetPixel(x,y);
      image.SetPixel(x,y,labels[y*w+x]==best?Color.FromArgb(255,c.R,c.G,c.B):Color.Transparent);
    }
  }
}
'@ -ReferencedAssemblies System.Drawing.Common,System.Drawing.Primitives

$taskRoot = [IO.Path]::GetFullPath($Workspace)
$taskSources = Join-Path $taskRoot 'docs/asset-packs/sources/maitre-portrait'
$taskOutput = Join-Path $taskRoot 'public/assets/zombies/portrait'
[IO.Directory]::CreateDirectory($taskOutput) | Out-Null
$sheets = @(
  @{file='contained-blades.png'; columns=2; rows=2; cell=627; pad=26; xShift=0; xOffsets=@(-16,13); ground=@(581,585); poses=@('blades-windup','blades-windup-b','blades-release','blades-followthrough')},
  @{file='contained-actions.png'; columns=3; rows=3; cell=418; pad=17; xShift=0; xOffsets=@(-18,5,27); ground=@(384,384,384); poses=@('idle','walk-a','walk-b','tear-windup','tear-windup-b','tear-release','recovery','transform-a','transform-b')},
  @{file='emerged-blades.png'; columns=2; rows=2; cell=631; pad=38; xShift=0; ground=@(589,564); poses=@('phase2-blades-windup','phase2-blades-windup-b','phase2-blades-release','phase2-blades-followthrough')},
  @{file='emerged-actions.png'; columns=3; rows=3; cell=421; pad=40; xShift=-20; xOffsets=@(0,0,4); ground=@(409,396,394); poses=@('phase2-idle','phase2-walk-a','phase2-walk-b','phase2-tear-windup','phase2-tear-windup-b','phase2-tear-release','phase2-recovery','sweep-windup','sweep-release')},
  @{file='emergence-death.png'; columns=2; rows=1; cell=887; pad=54; xShift=0; ground=@(859); poses=@('transform-c','death')}
)
# Décalages entiers d'appui, mesurés une fois après export ; aucune pose n'est
# redimensionnée pour remplir sa silhouette. Les mains basses sont des appuis.
$groundCorrections = @{
  'death'=7; 'phase2-blades-followthrough'=4; 'phase2-tear-windup'=12;
  'phase2-tear-windup-b'=10; 'phase2-walk-a'=11; 'phase2-walk-b'=10;
  'sweep-windup'=3; 'sweep-release'=3; 'transform-b'=-4
}
foreach($sheet in $sheets) {
  $source=[Drawing.Bitmap]::FromFile((Join-Path $taskSources $sheet.file))
  try {
    $cell=[int]$sheet.cell; $pad=[int]$sheet.pad; $extent=$cell+2*$pad
    for($index=0;$index -lt $sheet.poses.Count;$index++) {
      $column=$index % $sheet.columns; $row=[int][Math]::Floor($index/$sheet.columns)
      # Une case légèrement rectangulaire est placée dans un carré sans étirement.
      $originX=[int][Math]::Round($column*$source.Width/$sheet.columns+($source.Width/$sheet.columns-$cell)/2+$sheet.xShift)
      $originY=[int][Math]::Round($row*$source.Height/$sheet.rows+($source.Height/$sheet.rows-$cell)/2)
      $tile=[Drawing.Bitmap]::new($extent,$extent,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $graphics=[Drawing.Graphics]::FromImage($tile)
        try {
          $graphics.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
          $graphics.DrawImage($source,[Drawing.Rectangle]::new(0,0,$extent,$extent),[Drawing.Rectangle]::new($originX-$pad,$originY-$pad,$extent,$extent),[Drawing.GraphicsUnit]::Pixel)
        } finally {$graphics.Dispose()}
        $image=[Drawing.Bitmap]::new(384,384,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
          $graphics=[Drawing.Graphics]::FromImage($image)
          try {
            $graphics.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
            $graphics.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::Half
            $offset=[int][Math]::Round(360-($sheet.ground[$row]+$pad)*384/$extent)
            $pose=$sheet.poses[$index]
            $offset += $(if($groundCorrections.ContainsKey($pose)){$groundCorrections[$pose]}else{0})
            $offsetX=$(if($sheet.ContainsKey('xOffsets')){$sheet.xOffsets[$column]}else{0})
            $graphics.DrawImage($tile,[Drawing.Rectangle]::new($offsetX,$offset,384,384),0,0,$extent,$extent,[Drawing.GraphicsUnit]::Pixel)
          } finally {$graphics.Dispose()}
          [PortraitAlpha]::KeepBody($image)
          $image.Save((Join-Path $taskOutput ($sheet.poses[$index]+'.png')),[Drawing.Imaging.ImageFormat]::Png)
        } finally {$image.Dispose()}
      } finally {$tile.Dispose()}
    }
  } finally {$source.Dispose()}
}
Write-Output 'Portrait : 28 sprites RGBA 384 x 384 exportés.'
