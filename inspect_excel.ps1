$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open('C:\Users\Manager\Desktop\app\Order_Guide_Order_History_21116_2026-15-08_07-44-48.xlsx')
$sheet = $wb.Sheets.Item(1)

for ($r = 7; $r -le 15; $r++) {
    $vals = @()
    for ($c = 1; $c -le 12; $c++) {
        $vals += ("Col ${c}: " + $sheet.Cells.Item($r, $c).Text)
    }
    Write-Host "Row ${r} -> $($vals -join ' | ')"
}

$wb.Close($false)
$excel.Quit()
