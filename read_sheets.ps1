$tempDir = 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app\excel_tmp'
[xml]$wb = Get-Content (Join-Path $tempDir 'xl\workbook.xml')
foreach ($sheet in $wb.workbook.sheets.sheet) {
  Write-Host "Sheet Tab Name: '$($sheet.name)' | Sheet ID: $($sheet.sheetId) | r:id: $($sheet.id)"
}

$sheetsDir = Join-Path $tempDir 'xl\worksheets'
Get-ChildItem $sheetsDir | ForEach-Object { Write-Host "File: $($_.Name)" }
