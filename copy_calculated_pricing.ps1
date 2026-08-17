$appDir = 'C:\Users\Manager\Desktop\app'

$src = Join-Path $appDir 'pricing_CALCULATED.csv'
$dst1 = Join-Path $appDir 'pricing.csv'
$dst2 = Join-Path $appDir 'Master_Ingredient_Pricing_List.csv'

try {
    Copy-Item -Path $src -Destination $dst1 -Force
    Write-Host "Successfully updated pricing.csv!"
} catch {
    Write-Host "pricing.csv is currently open in a viewer. Saved as pricing_CALCULATED.csv!"
}

try {
    Copy-Item -Path $src -Destination $dst2 -Force
    Write-Host "Successfully updated Master_Ingredient_Pricing_List.csv!"
} catch {}
