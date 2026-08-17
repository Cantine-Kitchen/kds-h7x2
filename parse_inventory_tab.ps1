$tempDir = 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app\excel_tmp'

# Shared Strings Parser handling rich text runs <r><t>
$ssFile = Join-Path $tempDir 'xl\sharedStrings.xml'
[xml]$ssXml = Get-Content $ssFile
$sharedStrings = @()

foreach ($si in $ssXml.sst.si) {
  $str = ""
  if ($si.t) {
    if ($si.t.'#text') { $str = $si.t.'#text' } else { $str = [string]$si.t }
  } elseif ($si.r) {
    foreach ($r in $si.r) {
      if ($r.t) {
        if ($r.t.'#text') { $str += $r.t.'#text' } else { $str += [string]$r.t }
      }
    }
  }
  $sharedStrings += [string]$str
}

Write-Host "Shared strings loaded: $($sharedStrings.Count)"

# Sheet 2 (Inventory Tab)
$sheetFile = Join-Path $tempDir 'xl\worksheets\sheet2.xml'
[xml]$sheetXml = Get-Content $sheetFile

$inventoryItems = @()

foreach ($rowNode in $sheetXml.worksheet.sheetData.row) {
  $rIndex = [int]$rowNode.r
  $rowCells = @{}
  foreach ($c in $rowNode.c) {
    $cellRef = $c.r
    $colLetter = $cellRef -replace '[0-9]', ''
    $val = ''
    if ($c.v) {
      $rawVal = [string]$c.v
      if ($c.t -eq 's') {
        $ssIndex = [int]$rawVal
        if ($ssIndex -lt $sharedStrings.Count) {
          $val = $sharedStrings[$ssIndex]
        }
      } else {
        $val = $rawVal
      }
    }
    $rowCells[$colLetter] = [string]$val
  }

  $name = $rowCells['A']
  if ($name -and $name -ne 'ITEM NAME') {
    $item = @{
      row = $rIndex
      name = $name
      orderSize = if ($rowCells['B']) { $rowCells['B'] } else { '' }
      count = if ($rowCells['C']) { $rowCells['C'] } else { '' }
      parSized = if ($rowCells['D']) { $rowCells['D'] } else { '' }
      par = if ($rowCells['E']) { $rowCells['E'] } else { '' }
      notes = if ($rowCells['F']) { $rowCells['F'] } else { '' }
      category = if ($rowCells['G']) { $rowCells['G'] } else { 'General' }
      supplier = if ($rowCells['H']) { $rowCells['H'] } else { 'Unknown' }
    }
    $inventoryItems += $item
  }
}

Write-Host "Total Master Inventory Items Extracted: $($inventoryItems.Count)"
foreach ($item in $inventoryItems[0..30]) {
  Write-Host "ROW $($item.row): Name='$($item.name)' | Cat='$($item.category)' | Supp='$($item.supplier)' | Size='$($item.orderSize)' | Par='$($item.par) $($item.parSized)' | Notes='$($item.notes)'"
}

$purveyors = $inventoryItems | ForEach-Object { $_.supplier } | Select-Object -Unique
Write-Host "Unique Suppliers: $($purveyors -join ' | ')"
