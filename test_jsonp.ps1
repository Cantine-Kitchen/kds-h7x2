$url = 'https://script.google.com/macros/s/AKfycbzwC97-8v1ZvaTU7l0JapGtSj7r-b54fcH-kR7Rvu6QKmnnMcbIXUU1SsillriD91YeEA/exec?action=api&callback=testCb'
try {
  $text = Invoke-RestMethod -Uri $url -MaximumRedirection 5
  Write-Host "Response length: $($text.Length)"
  Write-Host "First 150 chars: $($text.Substring(0, [Math]::Min(150, $text.Length)))"
} catch {
  Write-Host "Error: $_"
}
