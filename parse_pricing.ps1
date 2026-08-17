$appDir = 'C:\Users\Manager\Desktop\app'

# 1. Parse Excel Order History / Guide if present
$excelPath = Join-Path $appDir 'Order_Guide_Order_History_21116_2026-15-08_07-44-48.xlsx'

$masterPricing = [System.Collections.ArrayList]::new()

# Load Excel COM
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    
    if (Test-Path $excelPath) {
        Write-Host "Reading Excel Order History: $excelPath"
        $wb = $excel.Workbooks.Open($excelPath)
        $sheet = $wb.Sheets.Item(1)
        
        $maxRow = $sheet.UsedRange.Rows.Count
        Write-Host "Total rows in Excel: $maxRow"

        # Read header row
        $headers = @()
        for ($c = 1; $c -le 15; $c++) {
            $headers += $sheet.Cells.Item(1, $c).Text.Trim()
        }
        Write-Host "Headers: $($headers -join ' | ')"

        for ($r = 8; $r -le $maxRow; $r++) {
            $name = $sheet.Cells.Item($r, 1).Text.Trim()
            if (-not $name -or $name -eq 'Item Name') { continue }

            $brand = $sheet.Cells.Item($r, 2).Text.Trim()
            $pack = $sheet.Cells.Item($r, 3).Text.Trim()
            $itemCode = $sheet.Cells.Item($r, 4).Text.Trim()
            $lastDate = $sheet.Cells.Item($r, 8).Text.Trim()
            $priceText = $sheet.Cells.Item($r, 10).Text.Trim().Replace('$', '').Replace(',', '')
            
            $price = 0.0
            [double]::TryParse($priceText, [ref]$price)

            # Compute estimated unit cost (per lb / oz / ct)
            $unitCost = 0.0
            $unitMeasure = 'per oz'

            if ($pack -match '(\d+)\s*x\s*(\d+\.?\d*)\s*LB') {
                $count = [double]$Matches[1]
                $lbs = [double]$Matches[2]
                $totalLbs = $count * $lbs
                if ($totalLbs -gt 0) {
                    $unitCost = [math]::Round($price / ($totalLbs * 16), 3)
                    $unitMeasure = 'per oz'
                }
            } elseif ($pack -match '(\d+)\s*x\s*(\d+\.?\d*)\s*OZ') {
                $count = [double]$Matches[1]
                $oz = [double]$Matches[2]
                $totalOz = $count * $oz
                if ($totalOz -gt 0) {
                    $unitCost = [math]::Round($price / $totalOz, 3)
                    $unitMeasure = 'per oz'
                }
            } elseif ($pack -match '(\d+)\s*x\s*(\d+\.?\d*)\s*DZ') {
                $count = [double]$Matches[1]
                $dz = [double]$Matches[2]
                $totalCount = $count * $dz * 12
                if ($totalCount -gt 0) {
                    $unitCost = [math]::Round($price / $totalCount, 3)
                    $unitMeasure = 'per egg'
                }
            } elseif ($pack -match '(\d+\.?\d*)\s*LB') {
                $lbs = [double]$Matches[1]
                if ($lbs -gt 0) {
                    $unitCost = [math]::Round($price / ($lbs * 16), 3)
                    $unitMeasure = 'per oz'
                }
            } else {
                $unitCost = [math]::Round($price / 1, 2)
                $unitMeasure = 'per case'
            }

            [void]$masterPricing.Add([PSCustomObject]@{
                'Ingredient Name'   = $name
                'Brand / Purveyor'  = if ($brand) { $brand } else { 'Distributor Order Guide' }
                'Item Code'         = $itemCode
                'Pack Size'         = $pack
                'Case Price ($)'    = $price
                'Unit Measure'      = $unitMeasure
                'Cost per Unit ($)' = $unitCost
                'Last Ordered'      = $lastDate
            })
        }
        $wb.Close($false)
    }
    $excel.Quit()
} catch {
    Write-Host "Excel COM note: $_"
}

# 2. Add Northern Haserot Items from PDF
$haserotItems = @(
    @{ Name="ARTISAN ROMAINE LETTUCE"; Pack="BOX 48CT"; Price=48.77; Unit="per ct"; Cost=1.02 },
    @{ Name="SPECTRUM MICRO GREENS"; Pack="PKG 8 OZ"; Price=25.39; Unit="per oz"; Cost=3.17 },
    @{ Name="SAN MARCO ROASTED TOMATOES"; Pack="4/2.5# FRZN"; Price=99.69; Unit="per oz"; Cost=0.62 },
    @{ Name="COOKED OCTOPUS TENTACLES (PULPO)"; Pack="12/12 OZ"; Price=210.75; Unit="per oz"; Cost=1.46 },
    @{ Name="TRI-COLOR DICED SWEET POTATO"; Pack="6/4#"; Price=57.75; Unit="per oz"; Cost=0.15 },
    @{ Name="RAINCOAST CRANBERRY HAZELNUT CRISPS"; Pack="8/7.9OZ"; Price=58.75; Unit="per oz"; Cost=0.93 },
    @{ Name="CULINAIRE DEMI GLACE GLUTEN FREE"; Pack="1/16#"; Price=184.59; Unit="per oz"; Cost=0.72 },
    @{ Name="GREEN PEPPERCORNS"; Pack="24/3.5 OZ"; Price=143.77; Unit="per oz"; Cost=1.71 },
    @{ Name="FIORUCCI DICED PANCETTA CRUDO"; Pack="5/2# BOX"; Price=110.78; Unit="per oz"; Cost=0.69 },
    @{ Name="MIXED HEIRLOOM TOMATOES"; Pack="BOX 10#"; Price=39.74; Unit="per oz"; Cost=0.25 },
    @{ Name="SAN MARCO FRESH PAPPARDELLE VEGAN"; Pack="30/4oz"; Price=38.95; Unit="per portion"; Cost=1.30 },
    @{ Name="CITTERIO ROSMARINO OVEN ROASTED HAM"; Pack="2/6-7#"; Price=85.67; Unit="per oz"; Cost=0.41 },
    @{ Name="CASTELVETRANO OLIVES PITTED"; Pack="2/4.4LB TINS"; Price=85.67; Unit="per oz"; Cost=0.61 },
    @{ Name="DON JUAN MARCONA ALMONDS SALTED"; Pack="2/4.4#"; Price=197.75; Unit="per oz"; Cost=1.40 },
    @{ Name="LEEKS 3 BUNCHES"; Pack="PKG 3 BUNCH"; Price=13.87; Unit="per bunch"; Cost=4.62 },
    @{ Name="ANISE / FENNEL 6CT"; Pack="PKG 6CT"; Price=29.97; Unit="per ct"; Cost=5.00 }
)

foreach ($h in $haserotItems) {
    [void]$masterPricing.Add([PSCustomObject]@{
        'Ingredient Name' = $h.Name
        'Purveyor'        = 'Northern Haserot'
        'Item Code'       = 'NHB'
        'Pack Size'       = $h.Pack
        'Case Price ($)'  = $h.Price
        'Unit Measure'    = $h.Unit
        'Cost per Unit ($)' = $h.Cost
    })
}

# 3. Add Catanese Meats & Seafood Items from PNG
$cataneseItems = @(
    @{ Name="4 OZ BEEF SLIDERS / SMASH BURGERS"; Pack="20/4 x 4 OZ BALLS"; Price=124.23; Unit="per patty"; Cost=1.55 },
    @{ Name="10 OZ CHOICE CC STRIP BEEF (STEAK FRITES)"; Pack="1/10 OZ PC(S)"; Price=19.18; Unit="per steak"; Cost=19.18 }
)

foreach ($c in $cataneseItems) {
    [void]$masterPricing.Add([PSCustomObject]@{
        'Ingredient Name' = $c.Name
        'Purveyor'        = 'Catanese Classic Seafood & Meats'
        'Item Code'       = 'CAT'
        'Pack Size'       = $c.Pack
        'Case Price ($)'  = $c.Price
        'Unit Measure'    = $c.Unit
        'Cost per Unit ($)' = $c.Cost
    })
}

# Export Master Pricing CSV
$masterPricingPath = Join-Path $appDir 'Master_Ingredient_Pricing_List.csv'
$masterPricing | Export-Csv -Path $masterPricingPath -NoTypeInformation -Encoding UTF8
Write-Host "Exported Master Pricing List to: $masterPricingPath"

# 4. Generate Recipe Menu Costing & Owner Presentation CSV
$menuCosting = @(
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Lit Burger'
        'Category' = 'Sandwiches'
        'Station' = 'Grill'
        'Portion Cost ($)' = 4.85
        'Current Menu Price ($)' = 15.00
        'Food Cost %' = '32.3%'
        'Gross Margin ($)' = 10.15
        'Target 30% Price ($)' = 16.17
        'Owner Recommendation' = 'Highly profitable signature burger ($10.15 margin). Keep price at $15 or test $16 for higher margin.'
    },
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Steak Frites (10 oz Bonner Farms Strip)'
        'Category' = 'Mains'
        'Station' = 'Grill'
        'Portion Cost ($)' = 21.50
        'Current Menu Price ($)' = 40.00
        'Food Cost %' = '53.8%'
        'Gross Margin ($)' = 18.50
        'Target 30% Price ($)' = 71.67
        'Owner Recommendation' = 'Generates $18.50 cash profit per plate. High food cost % compensated by high dollar margin.'
    },
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Chicken Milan'
        'Category' = 'Mains'
        'Station' = 'Fry'
        'Portion Cost ($)' = 5.20
        'Current Menu Price ($)' = 18.00
        'Food Cost %' = '28.9%'
        'Gross Margin ($)' = 12.80
        'Target 30% Price ($)' = 17.33
        'Owner Recommendation' = 'Star entree (28.9% food cost). Strong $12.80 gross profit margin.'
    },
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Pulpo (Grilled Octopus)'
        'Category' = 'Mains'
        'Station' = 'Grill'
        'Portion Cost ($)' = 9.80
        'Current Menu Price ($)' = 34.00
        'Food Cost %' = '28.8%'
        'Gross Margin ($)' = 24.20
        'Target 30% Price ($)' = 32.67
        'Owner Recommendation' = 'Exceptional high-margin entree ($24.20 profit per plate).'
    },
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Pan Roasted Tiger Prawns'
        'Category' = 'Mains'
        'Station' = 'Sauté'
        'Portion Cost ($)' = 11.40
        'Current Menu Price ($)' = 38.00
        'Food Cost %' = '30.0%'
        'Gross Margin ($)' = 26.60
        'Target 30% Price ($)' = 38.00
        'Owner Recommendation' = 'Perfect 30.0% food cost benchmark. Generates $26.60 gross profit per order.'
    },
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Ricotta Meatballs (with Pasta)'
        'Category' = 'Mains'
        'Station' = 'Sauté'
        'Portion Cost ($)' = 5.80
        'Current Menu Price ($)' = 24.00
        'Food Cost %' = '24.2%'
        'Gross Margin ($)' = 18.20
        'Target 30% Price ($)' = 19.33
        'Owner Recommendation' = 'High yield batch item. Outstanding 24.2% food cost.'
    },
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Fried Calamari'
        'Category' = 'Share Plates'
        'Station' = 'Fry'
        'Portion Cost ($)' = 4.10
        'Current Menu Price ($)' = 16.00
        'Food Cost %' = '25.6%'
        'Gross Margin ($)' = 11.90
        'Target 30% Price ($)' = 13.67
        'Owner Recommendation' = 'Great share plate driver (25.6% food cost).'
    },
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Caesar Salad'
        'Category' = 'Salads'
        'Station' = 'Pantry'
        'Portion Cost ($)' = 3.20
        'Current Menu Price ($)' = 14.00
        'Food Cost %' = '22.9%'
        'Gross Margin ($)' = 10.80
        'Target 30% Price ($)' = 10.67
        'Owner Recommendation' = 'Top margin starter (22.9% food cost).'
    },
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Baked Brie'
        'Category' = 'Share Plates'
        'Station' = 'Pantry'
        'Portion Cost ($)' = 5.10
        'Current Menu Price ($)' = 22.00
        'Food Cost %' = '23.2%'
        'Gross Margin ($)' = 16.90
        'Target 30% Price ($)' = 17.00
        'Owner Recommendation' = 'High-end appetizer ($16.90 profit per order).'
    },
    [PSCustomObject]@{
        'Recipe / Dish Name' = 'Truffle Fries'
        'Category' = 'Sides'
        'Station' = 'Fry'
        'Portion Cost ($)' = 1.85
        'Current Menu Price ($)' = 8.00
        'Food Cost %' = '23.1%'
        'Gross Margin ($)' = 6.15
        'Target 30% Price ($)' = 6.17
        'Owner Recommendation' = 'High-margin add-on side (76.9% gross margin).'
    }
)

$menuCostingPath = Join-Path $appDir 'Recipe_Menu_Costing_Owner_Report.csv'
$menuCosting | Export-Csv -Path $menuCostingPath -NoTypeInformation -Encoding UTF8
Write-Host "Exported Recipe Menu Costing Report to: $menuCostingPath"
