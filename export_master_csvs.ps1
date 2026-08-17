$outDir = 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app\master_sheets_import'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir }

# Read data.js contents
$jsonText = Get-Content 'C:\Users\Manager\.gemini\antigravity-ide\scratch\cantine-app\data.js' -Raw
$jsonText = $jsonText -replace '^window\.CANTINE_SEED_DATA =\s*', '' -replace ';\s*$', ''
$data = ConvertFrom-Json $jsonText

# 1. Staff.csv
$staffCsv = @("Name,Pin,Active,Role")
foreach ($s in $data.staff) {
  $staffCsv += """$($s.name)"",""$($s.pin)"",""$($s.active)"",""$($s.role)"""
}
Set-Content -Path (Join-Path $outDir 'Staff.csv') -Value $staffCsv -Encoding UTF8

# 2. Inventory.csv
$invCsv = @("ITEM NAME,ORDER SIZE,COUNT,PAR SIZED,PAR,NOTES,CATEGORY,SUPPLIER")
foreach ($i in $data.inventory) {
  $invCsv += """$($i.name)"",""$($i.orderSize)"",""$($i.count)"",""$($i.parSized)"",""$($i.par)"",""$($i.notes)"",""$($i.category)"",""$($i.supplier)"""
}
Set-Content -Path (Join-Path $outDir 'Inventory.csv') -Value $invCsv -Encoding UTF8

# 3. Suppliers.csv
$suppCsv = @("SUPPLIER ID,SUPPLIER NAME,REP NAME,PHONE,EMAIL")
foreach ($s in $data.suppliers) {
  $suppCsv += """$($s.id)"",""$($s.name)"",""$($s.rep)"",""$($s.phone)"",""$($s.email)"""
}
Set-Content -Path (Join-Path $outDir 'Suppliers.csv') -Value $suppCsv -Encoding UTF8

# 4. Recipes.csv
$recCsv = @("Recipe Name,Category,Ingredients,Method,Yield/Notes")
foreach ($r in $data.recipes) {
  $ing = ($r.ingredients -replace '"', '""')
  $meth = ($r.method -replace '"', '""')
  $recCsv += """$($r.name)"",""$($r.category)"",""$ing"",""$meth"",""$($r.notes)"""
}
Set-Content -Path (Join-Path $outDir 'Recipes.csv') -Value $recCsv -Encoding UTF8

# 5. Prep Inventory.csv
$prepCsv = @("Item to Prepare,yes/no/maybe,categories")
foreach ($p in $data.prepInventory) {
  $prepCsv += """$($p.name)"","""",""$($p.category)"""
}
Set-Content -Path (Join-Path $outDir 'Prep Inventory.csv') -Value $prepCsv -Encoding UTF8

# 6. Schedule.csv
$schedCsv = @("Staff Name,Availability,MON,TUE,WED,THUR,FRI,SAT,SUN")
foreach ($sc in $data.schedule) {
  $s = $sc.shifts
  $schedCsv += """$($sc.name)"",""$($sc.availability)"",""$($s.MON)"",""$($s.TUE)"",""$($s.WED)"",""$($s.THUR)"",""$($s.FRI)"",""$($s.SAT)"",""$($s.SUN)"""
}
Set-Content -Path (Join-Path $outDir 'Schedule.csv') -Value $schedCsv -Encoding UTF8

Write-Host "Exported 6 Master CSV files to $outDir!"
