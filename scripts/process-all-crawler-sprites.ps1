param(
    [string]$BrainDir = "C:\Users\Administrateur\.gemini\antigravity\brain\e3d91873-7d36-43b8-a5b4-d7ba38f79af3",
    [string]$DestDir = "public\assets\zombies\crawler"
)

$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class SpriteBatchProcessor {
    public static void Process(string srcPath, string destPath, int targetW, int targetH, int threshold) {
        using (var src = new Bitmap(srcPath)) {
            int w = src.Width;
            int h = src.Height;
            using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                using (var g = Graphics.FromImage(bmp)) {
                    g.DrawImage(src, 0, 0, w, h);
                }

                bool[,] visited = new bool[w, h];
                Queue<Point> queue = new Queue<Point>();

                for (int x = 0; x < w; x++) {
                    Color c1 = bmp.GetPixel(x, 0);
                    if (c1.R >= threshold && c1.G >= threshold && c1.B >= threshold) {
                        visited[x, 0] = true; queue.Enqueue(new Point(x, 0));
                    }
                    Color c2 = bmp.GetPixel(x, h - 1);
                    if (c2.R >= threshold && c2.G >= threshold && c2.B >= threshold) {
                        visited[x, h - 1] = true; queue.Enqueue(new Point(x, h - 1));
                    }
                }
                for (int y = 0; y < h; y++) {
                    Color c1 = bmp.GetPixel(0, y);
                    if (c1.R >= threshold && c1.G >= threshold && c1.B >= threshold) {
                        visited[0, y] = true; queue.Enqueue(new Point(0, y));
                    }
                    Color c2 = bmp.GetPixel(w - 1, y);
                    if (c2.R >= threshold && c2.G >= threshold && c2.B >= threshold) {
                        visited[w - 1, y] = true; queue.Enqueue(new Point(w - 1, y));
                    }
                }

                Color transparent = Color.FromArgb(0, 0, 0, 0);
                int[] dx = { 1, -1, 0, 0 };
                int[] dy = { 0, 0, 1, -1 };

                while (queue.Count > 0) {
                    Point p = queue.Dequeue();
                    bmp.SetPixel(p.X, p.Y, transparent);
                    for (int i = 0; i < 4; i++) {
                        int nx = p.X + dx[i];
                        int ny = p.Y + dy[i];
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[nx, ny]) {
                            visited[nx, ny] = true;
                            Color c = bmp.GetPixel(nx, ny);
                            if (c.R >= threshold && c.G >= threshold && c.B >= threshold) {
                                queue.Enqueue(new Point(nx, ny));
                            }
                        }
                    }
                }

                int minX = w, minY = h, maxX = -1, maxY = -1;
                for (int y = 0; y < h; y++) {
                    for (int x = 0; x < w; x++) {
                        if (bmp.GetPixel(x, y).A > 30) {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }

                int cropW = Math.Max(1, maxX - minX + 1);
                int cropH = Math.Max(1, maxY - minY + 1);

                using (var dest = new Bitmap(targetW, targetH, PixelFormat.Format32bppArgb)) {
                    using (var dg = Graphics.FromImage(dest)) {
                        dg.Clear(transparent);
                        dg.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                        dg.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;

                        float scale = Math.Min((targetW * 0.95f) / cropW, (targetH * 0.70f) / cropH);
                        int dw = (int)(cropW * scale);
                        int dh = (int)(cropH * scale);
                        int dxPos = (targetW - dw) / 2;
                        int dyPos = targetH - dh - 8;

                        dg.DrawImage(bmp, new Rectangle(dxPos, dyPos, dw, dh), new Rectangle(minX, minY, cropW, cropH), GraphicsUnit.Pixel);
                    }
                    dest.Save(destPath, ImageFormat.Png);
                }
            }
        }
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
}

function Find-Latest([string]$pattern) {
    $files = Get-ChildItem -Path $BrainDir -Filter $pattern | Sort-Object LastWriteTime -Descending
    if ($files.Count -gt 0) { return $files[0].FullName }
    return $null
}

$mapping = @{
    "idle" = (Find-Latest "crawler_idle*.jpg")
    "crawl-a" = (Find-Latest "crawler_crawl_a*.jpg")
    "crawl-b" = (Find-Latest "crawler_crawl_b*.jpg")
    "attack" = (Find-Latest "crawler_attack*.jpg")
    "hurt" = (Find-Latest "crawler_hurt*.jpg")
    "death" = (Find-Latest "crawler_death*.jpg")
}

foreach ($entry in $mapping.GetEnumerator()) {
    $pose = $entry.Key
    $src = $entry.Value
    if ($src -and (Test-Path $src)) {
        $dest = Join-Path $DestDir "$pose.png"
        [SpriteBatchProcessor]::Process($src, $dest, 512, 512, 230)
        Write-Output "OK: $pose -> $dest (depuis $(Split-Path $src -Leaf))"
    } else {
        Write-Output "ATTENTE: Pose $pose non encore générée"
    }
}
