$text = Get-Content -Path 'C:\Users\Manager\Desktop\app\INVENTORY - Form Responses 1.csv' -Raw
$firstLine = ($text -split "`n")[0].Trim()

$items = @()
$cell = ""
$inQ = $false

for ($i = 0; $i -lt $firstLine.Length; $i++) {
  $c = $firstLine[$i]
  if ($c -eq '"') {
    $inQ = -not $inQ
  } elseif ($c -eq ',' -and -not $inQ) {
    $items += $cell.Trim()
    $cell = ""
  } else {
    $cell += $c
  }
}
if ($cell) { $items += $cell.Trim() }

Write-Host "Total raw header items: $($items.Count)"

$unique = @()
$seen = @{}

foreach ($item in $items) {
  $clean = $item.Trim('"').Trim()
  if ($clean -and $clean -ne 'Timestamp' -and -not $seen.ContainsKey($clean.ToLower())) {
    $seen[$clean.ToLower()] = $true
    $unique += $clean
  }
}

Write-Host "Total unique inventory items: $($unique.Count)"
$unique | ForEach-Object { Write-Host "ITEM: $_" }
