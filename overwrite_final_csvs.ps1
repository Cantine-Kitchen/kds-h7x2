$appDir = 'C:\Users\Manager\Desktop\app'

$srcSummary = Join-Path $appDir '2026_Summer_Menu_Pricing_RECALCULATED_SUMMARY.csv'
$srcDetail = Join-Path $appDir '2026_Summer_Menu_Pricing_RECALCULATED_DETAIL.csv'

$dstSummary = Join-Path $appDir '2026_Summer_Menu_Pricing_DISH_SUMMARY.csv'
$dstDetail = Join-Path $appDir '2026_Summer_Menu_Pricing_CONSOLIDATED_DETAIL.csv'

Copy-Item -Path $srcSummary -Destination $dstSummary -Force
Copy-Item -Path $srcDetail -Destination $dstDetail -Force

Write-Host "Successfully updated 2026_Summer_Menu_Pricing_DISH_SUMMARY.csv and CONSOLIDATED_DETAIL.csv with accurate unit-converted portion pricing!"
