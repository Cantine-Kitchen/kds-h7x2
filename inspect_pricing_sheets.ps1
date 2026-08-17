$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open('C:\Users\Manager\Desktop\app\2026 summer menu pricing_costs.xlsx')

Write-Host "Total Sheets: $($wb.Sheets.Count)"

for ($s = 1; $s -le $wb.Sheets.Count; $s++) {
    $sheet = $wb.Sheets.Item($s)
    Write-Host "-------------------------------------------"
    Write-Host "Sheet [$s]: $($sheet.Name)"
    
    for ($r = 1; $r -le 10; $r++) {
        $vals = @()
        for ($c = 1; $c -le 8; $c++) {
            $vals += $sheet.Cells.Item($r, $c).Text.Trim()
        }
        $line = $vals -join ' | '
        if ($line.Replace(' | ', '').Trim().Length -gt 0) {
            Write-Host "  Row ${r}: $line"
        }
    }
}

$wb.Close($false)
$excel.Quit()
