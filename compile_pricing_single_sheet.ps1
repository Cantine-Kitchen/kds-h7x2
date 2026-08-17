$excelPath = 'C:\Users\Manager\Desktop\app\2026 summer menu pricing_costs.xlsx'
$appDir = 'C:\Users\Manager\Desktop\app'

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$wb = $excel.Workbooks.Open($excelPath)

$consolidatedRows = [System.Collections.ArrayList]::new()
$dishSummaryRows = [System.Collections.ArrayList]::new()

Write-Host "Processing $($wb.Sheets.Count) sheets from Excel..."

for ($s = 1; $s -le $wb.Sheets.Count; $s++) {
    $sheet = $wb.Sheets.Item($s)
    $sheetName = $sheet.Name.Trim()

    if ($sheetName.ToUpper() -eq 'MASTER INGREDIENT LIST') { continue }

    # Clean display name from any prefix like '!!!!! '
    $cleanDishName = $sheetName.Replace('!!!!! ', '').Trim()

    # Read data range
    $maxRow = $sheet.UsedRange.Rows.Count
    if ($maxRow -lt 2) { continue }

    $dishTotalCost = 0.0
    $menuPrice = 0.0
    $profit = 0.0
    $actualMargin = 0.0
    $components = [System.Collections.ArrayList]::new()

    for ($r = 2; $r -le $maxRow; $r++) {
        $col1 = $sheet.Cells.Item($r, 1).Text.Trim()
        $col1Lower = $col1.ToLower()

        if ($col1Lower -eq 'total') {
            $costText = $sheet.Cells.Item($r, 7).Text.Trim().Replace('$', '').Replace(',', '')
            [double]::TryParse($costText, [ref]$dishTotalCost)
        } elseif ($col1Lower -eq 'menu price') {
            $priceText = $sheet.Cells.Item($r, 7).Text.Trim().Replace('$', '').Replace(',', '')
            [double]::TryParse($priceText, [ref]$menuPrice)
        } elseif ($col1Lower -eq 'profit') {
            $profitText = $sheet.Cells.Item($r, 7).Text.Trim().Replace('$', '').Replace(',', '')
            [double]::TryParse($profitText, [ref]$profit)
        } elseif ($col1Lower -eq 'actual margin') {
            $marginText = $sheet.Cells.Item($r, 7).Text.Trim().Replace('%', '').Replace(',', '')
            [double]::TryParse($marginText, [ref]$actualMargin)
            if ($actualMargin -gt 1.0) { $actualMargin = $actualMargin / 100.0 }
        } elseif ($col1 -and $col1Lower -ne 'target margin') {
            # This is a component row
            $compName = $col1
            $totalCostText = $sheet.Cells.Item($r, 2).Text.Trim().Replace('$', '').Replace(',', '')
            $totalQtyText = $sheet.Cells.Item($r, 3).Text.Trim()
            $uom = $sheet.Cells.Item($r, 4).Text.Trim()
            $costPerUnitText = $sheet.Cells.Item($r, 5).Text.Trim().Replace('$', '').Replace(',', '')
            $servingSizeText = $sheet.Cells.Item($r, 6).Text.Trim()
            $costPerServingText = $sheet.Cells.Item($r, 7).Text.Trim().Replace('$', '').Replace(',', '')

            $totalCost = 0.0; [double]::TryParse($totalCostText, [ref]$totalCost)
            $costPerUnit = 0.0; [double]::TryParse($costPerUnitText, [ref]$costPerUnit)
            $costPerServing = 0.0; [double]::TryParse($costPerServingText, [ref]$costPerServing)

            [void]$components.Add("${compName} (${servingSizeText} ${uom})")

            [void]$consolidatedRows.Add([PSCustomObject]@{
                'Dish Name'              = $cleanDishName
                'Record Type'            = 'Component Detail'
                'Component / Item'       = $compName
                'Total Cost ($)'         = $totalCost
                'Total Quantity'         = $totalQtyText
                'Unit of Measure'        = $uom
                'Cost per Unit ($)'      = $costPerUnit
                'Serving Size'           = $servingSizeText
                'Cost per Serving ($)'   = $costPerServing
                'Dish Total Plate Cost ($)' = ''
                'Menu Price ($)'         = ''
                'Gross Profit ($)'       = ''
                'Margin %'               = ''
                'Margin Status'          = ''
            })
        }
    }

    # Recalculate profit / margin if not explicitly parsed
    if ($menuPrice -gt 0 -and $dishTotalCost -gt 0) {
        $profit = $menuPrice - $dishTotalCost
        $actualMargin = $profit / $menuPrice
    }

    $marginPctString = [math]::Round($actualMargin * 100, 1).ToString() + '%'
    $targetSuggestedPrice = if ($dishTotalCost -gt 0) { [math]::Round($dishTotalCost / 0.30, 2) } else { 0.0 }

    $marginStatus = '🟢 TARGET EXCEEDED (≥70%)'
    if ($actualMargin -lt 0.675) {
        $marginStatus = '🔴 CRITICAL ALERT (<67.5%)'
    } elseif ($actualMargin -lt 0.70) {
        $marginStatus = '🟡 WARNING (67.5% - 70%)'
    }

    # Add Dish Summary row to consolidated file
    [void]$consolidatedRows.Add([PSCustomObject]@{
        'Dish Name'              = $cleanDishName
        'Record Type'            = 'DISH TOTAL SUMMARY'
        'Component / Item'       = "TOTAL PLATE ($($components.Count) Components)"
        'Total Cost ($)'         = ''
        'Total Quantity'         = ''
        'Unit of Measure'        = ''
        'Cost per Unit ($)'      = ''
        'Serving Size'           = ''
        'Cost per Serving ($)'   = $dishTotalCost
        'Dish Total Plate Cost ($)' = $dishTotalCost
        'Menu Price ($)'         = $menuPrice
        'Gross Profit ($)'       = $profit
        'Margin %'               = $marginPctString
        'Margin Status'          = $marginStatus
    })

    # Add to Dish Master Summary Table
    [void]$dishSummaryRows.Add([PSCustomObject]@{
        'Dish Name'                  = $cleanDishName
        'Components Summary'         = ($components -join ' + ')
        'Total Plate Cost ($)'       = $dishTotalCost
        'Menu Selling Price ($)'     = $menuPrice
        'Gross Profit ($)'           = $profit
        'Actual Margin %'            = $marginPctString
        'Target 70% Suggested Price ($)' = $targetSuggestedPrice
        'Margin Status'              = $marginStatus
    })
}

$wb.Close($false)
$excel.Quit()

# Export Consolidated Detail CSV (All components + dish totals on 1 sheet)
$consolidatedCsvPath = Join-Path $appDir '2026_Summer_Menu_Pricing_CONSOLIDATED_DETAIL.csv'
$consolidatedRows | Export-Csv -Path $consolidatedCsvPath -NoTypeInformation -Encoding UTF8
Write-Host "Exported Consolidated Detail CSV to: $consolidatedCsvPath"

# Export Clean Dish Master Summary CSV (1 row per dish)
$dishMasterCsvPath = Join-Path $appDir '2026_Summer_Menu_Pricing_DISH_SUMMARY.csv'
$dishSummaryRows | Export-Csv -Path $dishMasterCsvPath -NoTypeInformation -Encoding UTF8
Write-Host "Exported Clean Dish Master Summary CSV to: $dishMasterCsvPath"
