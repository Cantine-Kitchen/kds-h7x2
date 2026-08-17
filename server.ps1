$port = 8080
$folder = 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app'

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Cantine Web App Server running at http://localhost:$port/"
Write-Host "Opening browser..."
Start-Process "http://localhost:$port/index.html"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $localPath = $request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }
    
    $filePath = [System.IO.Path]::Combine($folder, $localPath)

    if (Test-Path $filePath -PathType Leaf) {
        $content = [System.IO.File]::ReadAllBytes($filePath)
        
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        switch ($ext) {
            ".html" { $response.ContentType = "text/html" }
            ".css"  { $response.ContentType = "text/css" }
            ".js"   { $response.ContentType = "application/javascript" }
            ".json" { $response.ContentType = "application/json" }
            ".png"  { $response.ContentType = "image/png" }
            default { $response.ContentType = "text/plain" }
        }

        $response.ContentLength64 = $content.Length
        try {
            $response.OutputStream.Write($content, 0, $content.Length)
        } catch {}
    } else {
        $response.StatusCode = 404
    }
    try { $response.OutputStream.Close() } catch {}
}
