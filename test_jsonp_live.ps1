$url = 'https://script.google.com/macros/s/AKfycbzwC97-8v1ZvaTU7l0JapGtSj7r-b54fcH-kR7Rvu6QKmnnMcbIXUU1SsillriD91YeEA/exec?action=api&callback=onLiveDataReady'
$req = Invoke-WebRequest -Uri $url -MaximumRedirection 5
$content = [string]$req.Content
Write-Host "Raw Content length: $($content.Length)"
Write-Host "First 120 chars: $($content.Substring(0, [Math]::Min(120, $content.Length)))"
