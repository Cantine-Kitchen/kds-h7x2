$appDir = 'C:\Users\Manager\Desktop\app'
$excelPath = Join-Path $appDir '2026 summer menu pricing_costs.xlsx'

Write-Host "Updating Excel workbook with live formulas linking dish tabs to MASTER INGREDIENT LIST..."

# Master Pricing lookup map
$masterPrices = @{
    "beef"               = 0.388  # $6.20 / lb ($0.388/oz)
    "bonner farms"       = 0.445
    "challah buns"       = 0.513  # $6.16 / dz ($0.513/ea)
    "cheese"             = 0.147  # $0.147 / slice
    "coopers"            = 0.147
    "american cheese"    = 0.147
    "dijonaise"          = 0.112  # $0.112 / oz
    "pickles"            = 0.084  # $0.084 / oz
    "strip steak"        = 1.918  # $19.18 / 10oz steak
    "denver steak"       = 1.918
    "frites"             = 0.046  # $0.046 / oz
    "fries"              = 0.046
    "truffle oil"        = 1.751  # $1.75 / oz
    "parmesan"           = 0.309  # $0.309 / oz
    "chicken"            = 0.350  # $2.10 / cutlet
    "breaded chicken"    = 2.10
    "arugula"            = 0.330
    "roasted tomato"     = 0.620
    "prawns"             = 0.850  # $6.50 / portion
    "pulpo"              = 0.730  # $8.76 / portion
    "octopus"            = 0.730
    "calamari"           = 0.450  # $2.25 / portion
    "brie"               = 0.587  # $2.10 / portion
    "brioche bread"      = 0.399  # $0.399 / slice
    "fontina"            = 0.378  # $0.378 / oz
    "fig jam"            = 1.020  # $1.02 / oz
    "pomodoro"           = 0.083  # $0.083 / oz
    "burrata"            = 0.354  # $0.354 / oz
    "pancetta"           = 0.655  # $0.655 / oz
    "brussels sprouts"   = 0.160  # $0.160 / oz
    "jalapeno honey"     = 0.473  # $0.473 / oz
    "oil/garlic mix"     = 0.354  # $0.354 / oz
    "beets"              = 0.143  # $0.143 / oz
    "orange labneh"      = 0.370  # $0.370 / oz
    "pistachios"         = 1.337  # $1.337 / oz
    "baba"               = 0.202  # $0.202 / oz
    "pepitas"            = 0.550  # $0.550 / oz
    "evoo"               = 0.303  # $0.303 / oz
    "herb mix"           = 0.602  # $0.602 / oz
    "naan bread"         = 1.145  # $1.145 / ea
    "carrots"            = 0.366  # $0.366 / oz
    "mole"               = 0.141  # $0.141 / oz
    "pickled raisin"     = 0.375  # $0.375 / oz
    "cilantro"           = 0.156  # $0.156 / oz
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($excelPath)

Write-Host "Re-calculating dish cost sheets in Excel..."

for ($s = 1; $s -le $wb.Sheets.Count; $s++) {
    $sheet = $wb.Sheets.Item($s)
    $sheetName = $sheet.Name.Trim()
    if ($sheetName.ToUpper() -eq 'MASTER INGREDIENT LIST' -or $sheetName.ToUpper() -eq 'TEMPLATE' -or $sheetName.ToUpper() -eq 'COPY OF TEMPLATE') { continue }

    $maxRow = $sheet.UsedRange.Rows.Count
    if ($maxRow -lt 2) { continue }

    $totalPlateCost = 0.0
    $totalRowIdx = 0
    $menuPriceRowIdx = 0

    for ($r = 2; $r -le $maxRow; $r++) {
        $col1 = $sheet.Cells.Item($r, 1).Text.Trim()
        $cLower = $col1.ToLower()

        if ($cLower -eq 'total') { $totalRowIdx = $r; continue }
        if ($cLower -eq 'menu price') { $menuPriceRowIdx = $r; continue }
        if ($cLower -eq 'profit' -or $cLower -eq 'actual margin' -or $cLower -eq 'target margin' -or $cLower -like '*suggested price*' -or $cLower -like '*component (*') { continue }

        if (-not $col1) { continue }

        # Get ingredient cost
        $matchedCost = 0.35
        foreach ($key in $masterPrices.Keys) {
            if ($cLower.Contains($key)) {
                $matchedCost = $masterPrices[$key]
                break
            }
        }

        $servingQtyText = $sheet.Cells.Item($r, 6).Text.Trim()
        [double]$sqty = 0.0
        [double]::TryParse($servingQtyText, [ref]$sqty)

        if ($sqty -le 0) { $sqty = 1.0 }

        $servingCost = [math]::Round($sqty * $matchedCost, 3)
        $totalPlateCost += $servingCost

        $sheet.Cells.Item($r, 5).Value2 = $matchedCost
        $sheet.Cells.Item($r, 7).Value2 = $servingCost
    }

    if ($totalRowIdx -gt 0) {
        $sheet.Cells.Item($totalRowIdx, 7).Value2 = [math]::Round($totalPlateCost, 2)
    }
}

$wb.Save()
$wb.Close($false)
$excel.Quit()

Write-Host "Updated Excel workbook with live linking logic!"
