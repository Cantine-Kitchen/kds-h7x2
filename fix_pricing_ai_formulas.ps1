$appDir = 'C:\Users\Manager\Desktop\app'
$pricingCsvPath = Join-Path $appDir 'pricing.csv'

Write-Host "Reading pricing.csv and replacing =AI(...) formulas with exact numeric calculations..."

$lines = Get-Content -Path $pricingCsvPath

# Regex/Parsing helper function for Pack Size strings
function Parse-PackSizeToOunces {
    param ([string]$packStr)

    if (-not $packStr) { return "" }

    $p = $packStr.Trim().ToUpper()

    # Special replacements
    $p = $p -replace '#CW', ' LB'
    $p = $p -replace '#', ' LB'
    $p = $p -replace 'KG', ' KG'
    $p = $p -replace 'GRM', ' GRM'

    # Check fraction patterns (e.g. 1/2 GAL, 1/4 GAL)
    $p = $p -replace '1/2 GAL', '64 OZ'
    $p = $p -replace '1/4 GAL', '32 OZ'
    $p = $p -replace '1/2 LB', '8 OZ'
    $p = $p -replace '1/4 LB', '4 OZ'
    $p = $p -replace '3/4 LB', '12 OZ'

    # Pattern: N x M UNIT (e.g. 6 x 6 OZ, 15 x 2 LB, 4 x 5 LB, 9 x 64 OZ)
    if ($p -match '^\s*(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)\s*(LB|LBS|OZ|OUNCE|OUNCES|GAL|GALLON|GALLONS|QT|QUART|QUARTS|PT|PINT|PINTS|CT|COUNT|DZ|DOZEN|KG|GRM|GRAMS)\s*$') {
        $count = [double]$Matches[1]
        $size  = [double]$Matches[2]
        $unit  = $Matches[3]

        if ($unit -like 'LB*') { return ($count * $size * 16.0) }
        if ($unit -like 'OZ*' -or $unit -like 'OUNCE*') { return ($count * $size) }
        if ($unit -like 'GAL*') { return ($count * $size * 128.0) }
        if ($unit -like 'QT*' -or $unit -like 'QUART*') { return ($count * $size * 32.0) }
        if ($unit -like 'PT*' -or $unit -like 'PINT*') { return ($count * $size * 16.0) }
        if ($unit -eq 'DZ' -or $unit -eq 'DOZEN') { return ($count * $size * 12.0) }
        if ($unit -eq 'CT' -or $unit -eq 'COUNT') { return ($count * $size) }
        if ($unit -like 'KG*') { return [math]::Round($count * $size * 35.274, 2) }
        if ($unit -like 'GRM*' -or $unit -like 'GRAM*') { return [math]::Round($count * $size * 0.035274, 2) }
    }

    # Pattern: N x M/K UNIT (e.g. 4/2.5 LB -> 4 x 2.5 LB)
    if ($p -match '^\s*(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)\s*(LB|LBS|OZ|OUNCE|OUNCES|GAL|GALLON|GALLONS|QT|QUART|QUARTS|PT|PINT|PINTS|CT|COUNT|DZ|DOZEN|KG|GRM|GRAMS)?\s*$') {
        $count = [double]$Matches[1]
        $size  = [double]$Matches[2]
        $unit  = if ($Matches[3]) { $Matches[3] } else { 'LB' }

        if ($unit -like 'LB*') { return ($count * $size * 16.0) }
        if ($unit -like 'OZ*' -or $unit -like 'OUNCE*') { return ($count * $size) }
        if ($unit -like 'GAL*') { return ($count * $size * 128.0) }
        if ($unit -like 'QT*') { return ($count * $size * 32.0) }
        if ($unit -eq 'DZ') { return ($count * $size * 12.0) }
        if ($unit -eq 'CT') { return ($count * $size) }
    }

    # Pattern: Single quantity with unit (e.g. 1 x 30 LB -> 30 LB -> 480 oz)
    if ($p -match '^\s*(?:1\s*X\s*)?(\d+(?:\.\d+)?)\s*(LB|LBS|OZ|OUNCE|OUNCES|GAL|GALLON|GALLONS|QT|QUART|QUARTS|PT|PINT|PINTS|CT|COUNT|DZ|DOZEN|KG|GRM|GRAMS)\s*$') {
        $size = [double]$Matches[1]
        $unit = $Matches[2]

        if ($unit -like 'LB*') { return ($size * 16.0) }
        if ($unit -like 'OZ*' -or $unit -like 'OUNCE*') { return $size }
        if ($unit -like 'GAL*') { return ($size * 128.0) }
        if ($unit -like 'QT*') { return ($size * 32.0) }
        if ($unit -like 'PT*') { return ($size * 16.0) }
        if ($unit -eq 'DZ' -or $unit -eq 'DOZEN') { return ($size * 12.0) }
        if ($unit -eq 'CT' -or $unit -eq 'COUNT') { return $size }
        if ($unit -like 'KG*') { return [math]::Round($size * 35.274, 2) }
        if ($unit -like 'GRM*' -or $unit -like 'GRAM*') { return [math]::Round($size * 0.035274, 2) }
    }

    # Fallback to text if count/case
    return $packStr
}

# Import CSV properly handling quotes
$pricingData = Import-Csv -Path $pricingCsvPath

$recalculatedRows = [System.Collections.ArrayList]::new()
$updatedCount = 0

foreach ($row in $pricingData) {
    $packStr = $row.'Pack Size'
    $casePriceText = $row.'Case Price ($)'.Replace('$', '').Replace(',', '').Trim()
    
    [double]$casePrice = 0.0
    [double]::TryParse($casePriceText, [ref]$casePrice)

    # Calculate numeric Pack Size (oz or count)
    $calcPackSize = Parse-PackSizeToOunces $packStr
    
    [double]$numericOz = 0.0
    $isNumeric = [double]::TryParse($calcPackSize.ToString(), [ref]$numericOz)

    $uom = $row.'Unit Measure'
    $costPerUnit = 0.0

    if ($isNumeric -and $numericOz -gt 0 -and $casePrice -gt 0) {
        $costPerUnit = [math]::Round($casePrice / $numericOz, 3)
    } else {
        [double]::TryParse($row.'Cost per Unit ($)', [ref]$costPerUnit)
    }

    $row.'Pack Size (oz)' = $calcPackSize
    $row.'Cost per Unit ($)' = $costPerUnit

    [void]$recalculatedRows.Add($row)
    $updatedCount++
}

# Overwrite pricing.csv with calculated numeric values
$pricingCsvPathOut = Join-Path $appDir 'pricing.csv'
$recalculatedRows | Export-Csv -Path $pricingCsvPathOut -NoTypeInformation -Encoding UTF8
Write-Host "Successfully updated $updatedCount rows in pricing.csv!"

# Also save Master_Ingredient_Pricing_List.csv
$masterPricingPathOut = Join-Path $appDir 'Master_Ingredient_Pricing_List.csv'
$recalculatedRows | Export-Csv -Path $masterPricingPathOut -NoTypeInformation -Encoding UTF8
Write-Host "Successfully updated Master_Ingredient_Pricing_List.csv!"
