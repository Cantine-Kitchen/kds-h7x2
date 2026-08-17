$url = 'https://script.google.com/macros/s/AKfycbzwC97-8v1ZvaTU7l0JapGtSj7r-b54fcH-kR7Rvu6QKmnnMcbIXUU1SsillriD91YeEA/exec?action=api'
$outDir = 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app'

try {
  $liveData = Invoke-RestMethod -Uri $url -MaximumRedirection 5
  if ($liveData.schedule) {
    # Read current data.js text to preserve inventory/recipes
    $jsonText = Get-Content (Join-Path $outDir 'data.js') -Raw
    $jsonText = $jsonText -replace '^window\.CANTINE_SEED_DATA =\s*', '' -replace ';\s*$', ''
    $dataObj = ConvertFrom-Json $jsonText
    
    # Update schedule with live Google Sheet schedule
    $dataObj.schedule = $liveData.schedule

    $newJson = ConvertTo-Json -InputObject $dataObj -Depth 10
    $jsContent = "window.CANTINE_SEED_DATA = $newJson;"
    Set-Content -Path (Join-Path $outDir 'data.js') -Value $jsContent -Encoding UTF8
    Write-Host "Updated data.js with live Google Sheet schedule data!"
  }
} catch {
  Write-Host "Error updating data.js: $_"
}
