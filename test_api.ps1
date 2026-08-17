$url = 'https://script.google.com/macros/s/AKfycbzwC97-8v1ZvaTU7l0JapGtSj7r-b54fcH-kR7Rvu6QKmnnMcbIXUU1SsillriD91YeEA/exec?action=api'
try {
  $resp = Invoke-RestMethod -Uri $url -MaximumRedirection 5
  Write-Host "Keys returned from live API: $(($resp.PSObject.Properties.Name -join ' | '))"
  if ($resp.schedule) {
    Write-Host "Live schedule count: $($resp.schedule.Count)"
    Write-Host "First live schedule row: $(($resp.schedule[0] | ConvertTo-Json -Compress))"
  } else {
    Write-Host "WARNING: 'schedule' key is missing from live Apps Script API response!"
  }
} catch {
  Write-Host "API Request failed: $_"
}
