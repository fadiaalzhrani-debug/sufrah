$root = Join-Path $PSScriptRoot ""
$port = if ($env:PORT) { $env:PORT } else { "4173" }
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $root at $prefix"
$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript"; ".css"="text/css"; ".svg"="image/svg+xml"; ".json"="application/json"; ".png"="image/png" }
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = $ctx.Request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($rel)) { $rel = "index.html" }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch { }
}
