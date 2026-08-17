$appDir = 'C:\Users\Manager\Desktop\app'
$pricingCsvPath = Join-Path $appDir 'pricing.csv'

function Convert-PackSizeToOuncesOrCount {
    param ([string]$packStr, [string]$uomStr)

    if (-not $packStr) { return "" }

    $p = $packStr.Trim().ToUpper()
    $u = if ($uomStr) { $uomStr.Trim().ToLower() } else { "" }

    $p = $p -replace '#CW', ' LB'
    $p = $p -replace '# CW', ' LB'
    $p = $p -replace '#', ' LB'
    $p = $p -replace 'LBS', ' LB'
    $p = $p -replace 'POUND', ' LB'
    $p = $p -replace 'POUNDS', ' LB'
    $p = $p -replace 'GALLON', ' GAL'
    $p = $p -replace 'GALLONS', ' GAL'
    $p = $p -replace 'QUART', ' QT'
    $p = $p -replace 'QUARTS', ' QT'
    $p = $p -replace 'PINT', ' PT'
    $p = $p -replace 'PINTS', ' PT'
    $p = $p -replace 'OUNCE', ' OZ'
    $p = $p -replace 'OUNCES', ' OZ'
    $p = $p -replace 'FL OZ', ' OZ'
    $p = $p -replace 'DOZEN', ' DZ'
    $p = $p -replace 'COUNT', ' CT'
    $p = $p -replace 'EACH', ' EA'

    $p = $p -replace '1/2 GAL', '64 OZ'
    $p = $p -replace '1/4 GAL', '32 OZ'
    $p = $p -replace '1/2 LB', '8 OZ'
    $p = $p -replace '1/4 LB', '4 OZ'
    $p = $p -replace '3/4 LB', '12 OZ'
    $p = $p -replace '1/2 BU', '240 OZ'
    $p = $p -replace '1/4 BU', '120 OZ'

    if ($p -like '*#10*' -or $p -like '*NO 10*' -or $p -like '*NO. 10*') {
        if ($p -match '(\d+(?:\.\d+)?)\s*X') {
            $num = [double]$Matches[1]
            return [math]::Round($num * 106.0, 2)
        }
        return 106.0
    }

    if ($p -like '*BU*' -or $p -like '*BUSHEL*') {
        if ($p -match '(\d+(?:\.\d+)?)\s*BU') {
            $num = [double]$Matches[1]
            return [math]::Round($num * 480.0, 2)
        }
        return 480.0
    }

    if ($p -match '^\s*(\d+(?:\.\d+)?)\s*(?:X|/)\s*(\d+(?:\.\d+)?)\s*(LB|OZ|GAL|QT|PT|DZ|CT|EA|KG|G|GRM|GRAMS|ML|LIT|LITER)?\s*$') {
        $count = [double]$Matches[1]
        $size  = [double]$Matches[2]
        $unit  = $Matches[3]

        if (-not $unit) {
            if ($u -like '*per oz*') { $unit = 'OZ' }
            elseif ($u -like '*per lb*') { $unit = 'LB' }
            else { $unit = 'LB' }
        }

        if ($unit -like 'LB*') { return [math]::Round($count * $size * 16.0, 2) }
        if ($unit -like 'OZ*') { return [math]::Round($count * $size, 2) }
        if ($unit -like 'GAL*') { return [math]::Round($count * $size * 128.0, 2) }
        if ($unit -like 'QT*') { return [math]::Round($count * $size * 32.0, 2) }
        if ($unit -like 'PT*') { return [math]::Round($count * $size * 16.0, 2) }
        if ($unit -eq 'DZ') { return [math]::Round($count * $size * 12.0, 2) }
        if ($unit -eq 'CT' -or $unit -eq 'EA') { return [math]::Round($count * $size, 2) }
        if ($unit -like 'KG*') { return [math]::Round($count * $size * 35.274, 2) }
        if ($unit -like 'GRM*' -or $unit -like 'G*') { return [math]::Round($count * $size * 0.035274, 2) }
    }

    if ($p -match '^\s*(?:1\s*X\s*)?(\d+(?:\.\d+)?)\s*(LB|OZ|GAL|QT|PT|DZ|CT|EA|KG|G|GRM|ML|LITER)?\s*$') {
        $size = [double]$Matches[1]
        $unit = $Matches[2]

        if (-not $unit) {
            if ($u -like '*per oz*') { $unit = 'OZ' }
            elseif ($u -like '*per lb*') { $unit = 'LB' }
            elseif ($u -like '*per case*') { $unit = 'LB' }
            else { $unit = 'LB' }
        }

        if ($unit -like 'LB*') { return [math]::Round($size * 16.0, 2) }
        if ($unit -like 'OZ*') { return [math]::Round($size, 2) }
        if ($unit -like 'GAL*') { return [math]::Round($size * 128.0, 2) }
        if ($unit -like 'QT*') { return [math]::Round($size * 32.0, 2) }
        if ($unit -like 'PT*') { return [math]::Round($size * 16.0, 2) }
        if ($unit -eq 'DZ') { return [math]::Round($size * 12.0, 2) }
        if ($unit -eq 'CT' -or $unit -eq 'EA') { return [math]::Round($size, 2) }
        if ($unit -like 'KG*') { return [math]::Round($size * 35.274, 2) }
    }

    if ($p -match '(\d+(?:\.\d+)?)') {
        $num = [double]$Matches[1]
        if ($p -like '*LB*' -or $p -like '*#*') { return [math]::Round($num * 16.0, 2) }
        if ($p -like '*GAL*') { return [math]::Round($num * 128.0, 2) }
        if ($p -like '*QT*') { return [math]::Round($num * 32.0, 2) }
        return $num
    }

    return $packStr
}

$pricingData = Import-Csv -Path $pricingCsvPath
$recalculatedRows = [System.Collections.ArrayList]::new()

foreach ($row in $pricingData) {
    $packStr = $row.'Pack Size'
    $uom = $row.'Unit Measure'
    $casePriceText = $row.'Case Price ($)'.Replace('$', '').Replace(',', '').Trim()

    [double]$casePrice = 0.0
    [double]::TryParse($casePriceText, [ref]$casePrice)

    $calcPackSize = Convert-PackSizeToOuncesOrCount $packStr $uom

    [double]$numericOz = 0.0
    $isNumeric = [double]::TryParse($calcPackSize.ToString(), [ref]$numericOz)

    $costPerUnit = 0.0
    if ($isNumeric -and $numericOz -gt 0 -and $casePrice -gt 0) {
        $costPerUnit = [math]::Round($casePrice / $numericOz, 4)
    } else {
        [double]::TryParse($row.'Cost per Unit ($)', [ref]$costPerUnit)
    }

    $row.'Pack Size (oz)' = $calcPackSize
    $row.'Cost per Unit ($)' = $costPerUnit

    [void]$recalculatedRows.Add($row)
}

$pricingCalcPath = Join-Path $appDir 'pricing_CALCULATED.csv'
$recalculatedRows | Export-Csv -Path $pricingCalcPath -NoTypeInformation -Encoding UTF8
Write-Host "Exported pricing_CALCULATED.csv"

try {
    $recalculatedRows | Export-Csv -Path $pricingCsvPath -NoTypeInformation -Encoding UTF8
    Write-Host "Successfully overwritten pricing.csv!"
} catch {
    Write-Host "Note: pricing.csv was locked by viewer, pricing_CALCULATED.csv was created."
}

$masterPricingPathOut = Join-Path $appDir 'Master_Ingredient_Pricing_List.csv'
try {
    $recalculatedRows | Export-Csv -Path $masterPricingPathOut -NoTypeInformation -Encoding UTF8
} catch {}
