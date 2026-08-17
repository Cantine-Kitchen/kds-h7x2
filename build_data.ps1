$appDir = 'C:\Users\Manager\Desktop\app'
$outDir = 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app'
$tempDir = 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app\excel_tmp'

# 1. Staff
$staffCsv = Import-Csv -Path (Join-Path $appDir 'cantine staff auth - Sheet1.csv')
$staff = [System.Collections.ArrayList]::new()
foreach ($row in $staffCsv) {
  if ($row.Name -and $row.Pin) {
    [void]$staff.Add(@{
      name = $row.Name
      pin = [string]$row.Pin
      active = ($row.Active -eq 'TRUE')
      role = if ($row.Name -like '*Chef*') { 'head_chef' } else { 'cook' }
    })
  }
}

# 2. Prep Inventory
$prepCsv = Import-Csv -Path (Join-Path $appDir 'PREP SHEET - Prep Inventory.csv')
$prepInventory = [System.Collections.ArrayList]::new()
$prepItems = [System.Collections.ArrayList]::new()
foreach ($row in $prepCsv) {
  $itemName = $row.'Item to Prepare'
  if ($itemName) {
    $cat = if ($row.catagories) { $row.catagories } else { 'General' }
    [void]$prepInventory.Add(@{ name = $itemName; category = $cat })
    [void]$prepItems.Add(@{ name = $itemName; category = $cat; status = 'STANDARD'; isDone = $false })
  }
}

# 3. Recipes
$recipeCsv = Import-Csv -Path (Join-Path $appDir 'Cantine Recipe Book - Cantine Recipe Book.csv')
$recipes = [System.Collections.ArrayList]::new()
foreach ($row in $recipeCsv) {
  $rName = $row.'Recipe Name'
  if ($rName -and $rName -ne 'Recipe Name') {
    $nLower = $rName.ToLower()
    $cLower = if ($row.Category) { $row.Category.ToLower() } else { '' }

    $st = if ($row.Station) { $row.Station } else { 'Prep' }
    if (-not $row.Station) {
      if ($nLower -like '*sauce*' -or $nLower -like '*glaze*' -or $nLower -like '*soup*') { $st = 'Sauté' }
      elseif ($nLower -like '*burger*' -or $nLower -like '*steak*' -or $nLower -like '*grill*') { $st = 'Grill' }
      elseif ($nLower -like '*salad*' -or $nLower -like '*dressing*' -or $nLower -like '*pantry*') { $st = 'Pantry' }
      elseif ($nLower -like '*fry*' -or $nLower -like '*fries*') { $st = 'Fry' }
      elseif ($nLower -like '*cake*' -or $nLower -like '*dough*' -or $cLower -like '*pastry*') { $st = 'Pastry' }
    }

    $wf = if ($row.WorkflowType) { $row.WorkflowType } else { 'Batch Prep' }
    if (-not $row.WorkflowType) {
      if ($nLower -like '*spec*' -or $nLower -like '*plating*') { $wf = 'Plating Spec' }
      elseif ($nLower -like '*sauce*' -or $nLower -like '*base*') { $wf = 'Sub-recipe' }
    }

    [void]$recipes.Add(@{
      name = $rName
      category = if ($row.Category) { $row.Category } else { 'Uncategorized' }
      ingredients = if ($row.Ingredients) { $row.Ingredients } else { '' }
      method = if ($row.Method) { $row.Method } else { '' }
      notes = if ($row.'Yield/Notes') { $row.'Yield/Notes' } else { '' }
      station = $st
      workflowType = $wf
      status = if ($row.Status) { $row.Status } else { 'Active' }
      dietary = if ($row.Dietary) { $row.Dietary } else { '' }
      photoUrl = if ($row.PhotoURL) { $row.PhotoURL } else { '' }
      tags = if ($row.Tags) { $row.Tags } else { '' }
    })
  }
}

# 4. Suppliers
$suppliers = @(
  @{ id = 'HILLCREST'; name = 'Hillcrest Foodservice'; rep = 'Becky'; phone = '216-350-5938'; email = '' },
  @{ id = 'HAZEROT'; name = 'Northern Haserot'; rep = 'Allison'; phone = '216-379-1768'; email = '' },
  @{ id = 'EURO'; name = 'Euro USA'; rep = 'Tom'; phone = '216-701-7752'; email = '' },
  @{ id = 'EUCLID FISH'; name = 'Euclid Fish Co'; rep = 'Geoff'; phone = '615-969-2728'; email = '' },
  @{ id = 'MICHAELS MEATS'; name = 'Michaels Meats'; rep = 'Ted'; phone = '216-339-4375'; email = '' },
  @{ id = 'STONE OVEN'; name = 'Stone Oven Wholesale'; rep = 'Stone Oven Bakery'; phone = ''; email = 'STONE.OVEN5@GMAIL.COM' },
  @{ id = 'STONEY CREEK'; name = 'Pebble Creek / Stoney Creek Produce'; rep = 'Nick'; phone = ''; email = 'NICK@PEBBLECREEKPRODUCE.COM' },
  @{ id = 'CANTONESE'; name = 'Cantonese Market'; rep = 'Tim'; phone = '216-407-4293'; email = '' }
)

# 5. Schedule
$schedText = Get-Content -Path (Join-Path $appDir 'CANTINE SCHEDULE - Sheet1.csv')
$schedule = [System.Collections.ArrayList]::new()
foreach ($line in $schedText) {
  $parts = $line.Split(',')
  $namePart = [string]$parts[0].Trim()
  if ($namePart -and $namePart -ne 'legend  --->' -and $namePart -ne 'availability' -and $namePart -ne 'Name') {
    [void]$schedule.Add(@{
      name = $namePart
      availability = [string]$parts[1].Trim()
      shifts = @{
        MON = if ($parts[2]) { [string]$parts[2].Trim() } else { 'x' }
        TUE = if ($parts[3]) { [string]$parts[3].Trim() } else { 'x' }
        WED = if ($parts[4]) { [string]$parts[4].Trim() } else { 'x' }
        THUR = if ($parts[5]) { [string]$parts[5].Trim() } else { 'x' }
        FRI = if ($parts[6]) { [string]$parts[6].Trim() } else { 'x' }
        SAT = if ($parts[7]) { [string]$parts[7].Trim() } else { 'x' }
        SUN = if ($parts[8]) { [string]$parts[8].Trim() } else { 'x' }
      }
    })
  }
}

# 6. Parse Sheet2 (Inventory Tab from INVENTORY (1).xlsx)
$ssFile = Join-Path $tempDir 'xl\sharedStrings.xml'
[xml]$ssXml = Get-Content $ssFile
$sharedStrings = @()
foreach ($si in $ssXml.sst.si) {
  $str = ""
  if ($si.t) {
    if ($si.t.'#text') { $str = $si.t.'#text' } else { $str = [string]$si.t }
  } elseif ($si.r) {
    foreach ($r in $si.r) {
      if ($r.t) {
        if ($r.t.'#text') { $str += $r.t.'#text' } else { $str += [string]$r.t }
      }
    }
  }
  $sharedStrings += [string]$str
}

$sheetFile = Join-Path $tempDir 'xl\worksheets\sheet2.xml'
[xml]$sheetXml = Get-Content $sheetFile
$inventory = [System.Collections.ArrayList]::new()

foreach ($rowNode in $sheetXml.worksheet.sheetData.row) {
  $rIndex = [int]$rowNode.r
  $rowCells = @{}
  foreach ($c in $rowNode.c) {
    $cellRef = $c.r
    $colLetter = $cellRef -replace '[0-9]', ''
    $val = ''
    if ($c.v) {
      $rawVal = [string]$c.v
      if ($c.t -eq 's') {
        $ssIndex = [int]$rawVal
        if ($ssIndex -lt $sharedStrings.Count) { $val = $sharedStrings[$ssIndex] }
      } else {
        $val = $rawVal
      }
    }
    $rowCells[$colLetter] = [string]$val
  }

  $name = [string]$rowCells['A']
  if ($name -and $name -ne 'ITEM NAME') {
    $cleanSupp = ([string]$rowCells['H']).Trim().ToUpper()
    if (-not $cleanSupp) { $cleanSupp = 'HILLCREST' }
    $parVal = [string]$rowCells['E']
    $parNum = if ($parVal -match '[\d\.]+') { $matches[0] } else { '' }

    [void]$inventory.Add(@{
      row = $rIndex
      name = $name.Trim()
      orderSize = ([string]$rowCells['B']).Trim()
      count = ([string]$rowCells['C']).Trim()
      parSized = ([string]$rowCells['D']).Trim()
      par = $parNum
      notes = ([string]$rowCells['F']).Trim()
      category = if ($rowCells['G']) { ([string]$rowCells['G']).Trim() } else { 'General' }
      supplier = $cleanSupp
    })
  }
}

$masterData = [ordered]@{
  staff = $staff
  suppliers = $suppliers
  inventory = $inventory
  prepInventory = $prepInventory
  prepItems = $prepItems
  recipes = $recipes
  schedule = $schedule
  passdownNotes = @()
}

$json = ConvertTo-Json -InputObject $masterData -Depth 10
$jsContent = "window.CANTINE_SEED_DATA = $json;"
Set-Content -Path (Join-Path $outDir 'data.js') -Value $jsContent -Encoding UTF8
Write-Host "SUCCESS! Generated data.js with $($inventory.Count) Inventory items, $($recipes.Count) recipes, $($schedule.Count) schedule rows, and $($staff.Count) staff PINs!"
