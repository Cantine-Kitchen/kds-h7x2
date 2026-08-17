$appDir = 'C:\Users\Manager\Desktop\app'
$outDir = 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app'

$recipeCsvPath = Join-Path $appDir 'Cantine Master Database - Recipes (1).csv'
if (-not (Test-Path $recipeCsvPath)) {
    $recipeCsvPath = Join-Path $appDir 'Cantine Recipe Book - Cantine Recipe Book.csv'
}

Write-Host "Reading recipes from: $recipeCsvPath"
$recipesCsv = Import-Csv -Path $recipeCsvPath

# Active Summer Menu 2026 Items for Context
$activeMenuItems = @(
  "baked brie", "wings", "hummus", "crispy eggplant", "chorizo tacos", "fried calamari", "green tomatoes",
  "ricotta meatballs", "tartine", "lasagna", "pulpo", "prawns", "chicken milan", "steak frites",
  "lit burger", "burger", "grilled cheese", "kfc", "blt",
  "caesar salad", "beet salad", "panzanella",
  "truffle fries", "grilled pugliese", "fried brussel", "arugula salad"
)

$enhancedRecipes = [System.Collections.ArrayList]::new()

foreach ($row in $recipesCsv) {
    $name = [string]$row.'Recipe Name'
    if (-not $name -or $name -eq 'Recipe Name') { continue }

    $category = if ($row.Category) { [string]$row.Category } else { 'General' }
    $ingredients = if ($row.Ingredients) { [string]$row.Ingredients } else { '' }
    $method = if ($row.Method) { [string]$row.Method } else { '' }
    $notes = if ($row.'Yield/Notes') { [string]$row.'Yield/Notes' } else { '' }

    $nameLower = $name.ToLower()
    $catLower = $category.ToLower()
    $ingLower = $ingredients.ToLower()
    $methLower = $method.ToLower()
    $notesLower = $notes.ToLower()

    # 1. Legacy Check: If 'old' is in the name, flag as Legacy!
    $isLegacy = ($nameLower -like '*old*' -or $nameLower -like '*(old)*' -or $notesLower -like '*old spec*')
    $status = if ($isLegacy) { 'Legacy' } elseif ($row.Status) { [string]$row.Status } else { 'Active' }

    # Clean display name if needed or preserve
    $displayName = $name

    # 2. Determine Station
    $station = if ($row.Station) { [string]$row.Station } else { '' }
    if (-not $station) {
        if ($nameLower -like '*steak*' -or $nameLower -like '*burger*' -or $nameLower -like '*patty*' -or $nameLower -like '*grill*' -or $nameLower -like '*pulpo*' -or $nameLower -like '*octopus*' -or $nameLower -like '*prawn*' -or $nameLower -like '*bread*') {
            $station = 'Grill'
        } elseif ($nameLower -like '*sauce*' -or $nameLower -like '*pomodoro*' -or $nameLower -like '*meatball*' -or $nameLower -like '*lasagna*' -or $nameLower -like '*reduction*' -or $nameLower -like '*soup*' -or $nameLower -like '*sauté*' -or $nameLower -like '*saute*' -or $nameLower -like '*glaze*') {
            $station = 'Sauté'
        } elseif ($nameLower -like '*salad*' -or $nameLower -like '*dressing*' -or $nameLower -like '*pantry*' -or $nameLower -like '*hummus*' -or $nameLower -like '*tartine*' -or $nameLower -like '*pickled*' -or $nameLower -like '*aioli*' -or $nameLower -like '*crema*' -or $nameLower -like '*vinaigrette*' -or $nameLower -like '*brie*' -or $nameLower -like '*mostarda*') {
            $station = 'Pantry'
        } elseif ($nameLower -like '*fry*' -or $nameLower -like '*fries*' -or $nameLower -like '*calamari*' -or $nameLower -like '*eggplant*' -or $nameLower -like '*kfc*' -or $nameLower -like '*green tomato*' -or $nameLower -like '*brussel*') {
            $station = 'Fry'
        } elseif ($nameLower -like '*pastry*' -or $nameLower -like '*dough*' -or $nameLower -like '*cake*' -or $nameLower -like '*dessert*' -or $catLower -like '*pastry*') {
            $station = 'Pastry'
        } else {
            $station = 'Prep'
        }
    }

    # 3. Determine Workflow Type
    $workflowType = if ($row.WorkflowType) { [string]$row.WorkflowType } else { '' }
    if (-not $workflowType) {
        if ($nameLower -like '*spec*' -or $nameLower -like '*plating*' -or ($activeMenuItems | Where-Object { $nameLower -like "*$_*" })) {
            $workflowType = 'Plating Spec'
        } elseif ($nameLower -like '*dressing*' -or $nameLower -like '*sauce*' -or $nameLower -like '*aioli*' -or $nameLower -like '*vinaigrette*' -or $nameLower -like '*crema*' -or $nameLower -like '*glaze*' -or $nameLower -like '*rub*' -or $nameLower -like '*spice*' -or $nameLower -like '*pickled*') {
            $workflowType = 'Sub-recipe'
        } else {
            $workflowType = 'Batch Prep'
        }
    }

    # 4. Determine Dietary Tags
    $dietary = if ($row.Dietary) { [string]$row.Dietary } else { '' }
    if (-not $dietary) {
        $dietList = [System.Collections.ArrayList]::new()
        if ($ingLower -like '*gluten free*' -or $nameLower -like '*gf*' -or $catLower -like '*gf*') { [void]$dietList.Add('GF') }
        if ($ingLower -like '*dairy free*' -or $nameLower -like '*df*') { [void]$dietList.Add('DF') }
        if ($nameLower -like '*(vg)*' -or $nameLower -like '*vegetarian*' -or $catLower -like '*veg*') { [void]$dietList.Add('Vegetarian') }
        if ($ingLower -like '*vegan*' -or $nameLower -like '*vegan*') { [void]$dietList.Add('Vegan') }
        if ($ingLower -like '*almond*' -or $ingLower -like '*walnut*' -or $ingLower -like '*pecan*' -or $ingLower -like '*pepita*') { [void]$dietList.Add('Nut Alert') }
        $dietary = $dietList -join ', '
    }

    # 5. Generate Comprehensive Line-Cook Search Tags
    $tagsList = [System.Collections.ArrayList]::new()
    
    # Add station & workflow keywords
    [void]$tagsList.Add($station.ToLower())
    [void]$tagsList.Add($workflowType.ToLower())
    [void]$tagsList.Add($category.ToLower())

    if ($isLegacy) {
        [void]$tagsList.Add('legacy')
        [void]$tagsList.Add('old spec')
        [void]$tagsList.Add('archive')
    } else {
        [void]$tagsList.Add('active')
        [void]$tagsList.Add('current menu')
    }

    # Station nicknames & line zones
    if ($station -eq 'Pantry') { [void]$tagsList.Add('gdm'); [void]$tagsList.Add('garde manger'); [void]$tagsList.Add('cold line'); [void]$tagsList.Add('salad station') }
    if ($station -eq 'Grill') { [void]$tagsList.Add('charbroiler'); [void]$tagsList.Add('hot line'); [void]$tagsList.Add('meat station') }
    if ($station -eq 'Sauté') { [void]$tagsList.Add('pan station'); [void]$tagsList.Add('hot line'); [void]$tagsList.Add('sauce station') }
    if ($station -eq 'Fry') { [void]$tagsList.Add('fryer'); [void]$tagsList.Add('basket'); [void]$tagsList.Add('hot line') }

    # Extract ingredient keywords
    $commonSearchTerms = @(
      'garlic', 'onion', 'shallot', 'parmesan', 'piave', 'ricotta', 'burrata', 'goat cheese', 'comte', 'coopers',
      'mayo', 'aioli', 'mustard', 'dijon', 'vinegar', 'balsamic', 'oil', 'evoo', 'butter', 'cream',
      'beef', 'bonner farms', 'chicken', 'pork', 'chorizo', 'pancetta', 'bacon', 'octopus', 'pulpo', 'prawn', 'shrimp', 'calamari', 'fish',
      'tomato', 'pomodoro', 'peppercorn', 'truffle', 'arugula', 'romaine', 'beet', 'eggplant', 'brussel', 'corn', 'succotash',
      'kimchi', 'gochujang', 'oi muchim', 'korean', 'buffalo', 'gorgonzola', 'hot honey', 'mostarda', 'caponata', 'romesco',
      'fries', 'feta', 'pita', 'challah', 'pugliese', 'pasta', 'pappardelle', 'lasagna', 'wings', 'taco', 'burger', 'sandwich'
    )

    foreach ($term in $commonSearchTerms) {
        if ($nameLower -like "*$term*" -or $ingLower -like "*$term*" -or $methLower -like "*$term*") {
            if (-not $tagsList.Contains($term)) {
                [void]$tagsList.Add($term)
            }
        }
    }

    # Preparation techniques
    $prepTerms = @('blanched', 'roasted', 'braised', 'fried', 'confit', 'pickled', 'emulsified', 'reduction', 'pureed', 'dredged', 'brined', 'cured', 'baked', 'charred', 'smoked')
    foreach ($pt in $prepTerms) {
        if ($nameLower -like "*$pt*" -or $methLower -like "*$pt*" -or $ingLower -like "*$pt*") {
            if (-not $tagsList.Contains($pt)) {
                [void]$tagsList.Add($pt)
            }
        }
    }

    $tagsString = ($tagsList | Select-Object -Unique) -join ', '

    [void]$enhancedRecipes.Add([PSCustomObject]@{
        'Recipe Name'  = $displayName
        'Category'     = $category
        'Ingredients'  = $ingredients
        'Method'       = $method
        'Yield/Notes'  = $notes
        'Station'      = $station
        'WorkflowType' = $workflowType
        'Status'       = $status
        'Dietary'      = $dietary
        'PhotoURL'     = if ($row.PhotoURL) { $row.PhotoURL } else { '' }
        'Tags'         = $tagsString
    })
}

Write-Host "Processed $($enhancedRecipes.Count) recipes successfully!"

# Export Enhanced CSV to Desktop App directory
$exportCsvPath = Join-Path $appDir 'Cantine Master Database - Recipes (ENHANCED).csv'
$enhancedRecipes | Export-Csv -Path $exportCsvPath -NoTypeInformation -Encoding UTF8
Write-Host "Exported enhanced CSV to: $exportCsvPath"

# Also overwrite main Recipe CSV so build_data.ps1 uses it automatically
$mainCsvPath = Join-Path $appDir 'Cantine Recipe Book - Cantine Recipe Book.csv'
$enhancedRecipes | Export-Csv -Path $mainCsvPath -NoTypeInformation -Encoding UTF8
Write-Host "Updated main CSV at: $mainCsvPath"
