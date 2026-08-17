$xlsxPath = 'C:\Users\Manager\Desktop\app\INVENTORY (1).xlsx'
$tempDir = 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app\excel_tmp'

if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($xlsxPath, $tempDir)

# Load shared strings
$ssFile = Join-Path $tempDir 'xl\sharedStrings.xml'
$sharedStrings = @()
if (Test-Path $ssFile) {
  [xml]$ssXml = Get-Content $ssFile
  foreach ($si in $ssXml.sst.si) {
    $t = $si.t
    if (-not $t -and $si.r) {
      $t = ($si.r | ForEach-Object { $_.t }) -join ''
    }
    $sharedStrings += if ($t) { $t } else { '' }
  }
}

Write-Host "Shared strings count: $($sharedStrings.Count)"

# Load Sheet 1
$sheetFile = Join-Path $tempDir 'xl\worksheets\sheet1.xml'
[xml]$sheetXml = Get-Content $sheetFile

$rows = @()
foreach ($rowNode in $sheetXml.worksheet.sheetData.row) {
  $rIndex = [int]$rowNode.r
  $rowCells = @{}
  foreach ($c in $rowNode.c) {
    $cellRef = $c.r
    # extract column letter
    $colLetter = $cellRef -replace '[0-9]', ''
    $val = ''
    if ($c.v) {
      $rawVal = $c.v
      if ($c.t -eq 's') {
        $ssIndex = [int]$rawVal
        if ($ssIndex -lt $sharedStrings.Count) {
          $val = $sharedStrings[$ssIndex]
        }
      } else {
        $val = $rawVal
      }
    }
    $rowCells[$colLetter] = $val
  }
  $rows += @{ index = $rIndex; cells = $rowCells }
}

Write-Host "Total rows found in Excel sheet: $($rows.Count)"

# Display header row and first 10 rows
foreach ($r in $rows[0..15]) {
  $c = $r.cells
  Write-Host "Row $($r.index): A='$($c['A'])' | B='$($c['B'])' | C='$($c['C'])' | D='$($c['D'])' | E='$($c['E'])' | F='$($c['F'])' | G='$($c['G'])' | H='$($c['H'])'"
}
