# SAXMegaMind Documents - Create Application Insights Alerts
# Copyright (c) 2024 SAXTech

param(
    [string]$ResourceGroup = "SAXTech-AI",
    [string]$AppInsightsName = "saxtechmegamindfunctions",
    [string]$FunctionAppName = "saxtechmegamindfunctions"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "SAXMegaMind Document System" -ForegroundColor Cyan
Write-Host "Creating Monitoring Alerts" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Get Application Insights resource ID
$appInsightsId = az monitor app-insights component show `
    --app $AppInsightsName `
    --resource-group $ResourceGroup `
    --query id -o tsv

Write-Host "Application Insights ID: $appInsightsId" -ForegroundColor Yellow
Write-Host ""

# Alert 1: High Error Rate
Write-Host "Creating alert: High Error Rate..." -ForegroundColor Yellow
az monitor metrics alert create `
    --name "SAXMegaMind-HighErrorRate" `
    --resource-group $ResourceGroup `
    --scopes $appInsightsId `
    --condition "avg requests/failed > 0.1" `
    --window-size 5m `
    --evaluation-frequency 1m `
    --severity 2 `
    --description "Alert when error rate exceeds 10% in 5 minutes"

# Alert 2: Slow Response Time
Write-Host "Creating alert: Slow Response Time..." -ForegroundColor Yellow
az monitor metrics alert create `
    --name "SAXMegaMind-SlowResponse" `
    --resource-group $ResourceGroup `
    --scopes $appInsightsId `
    --condition "avg requests/duration > 5000" `
    --window-size 5m `
    --evaluation-frequency 1m `
    --severity 3 `
    --description "Alert when average response time exceeds 5 seconds"

# Alert 3: Function App Down
Write-Host "Creating alert: Function App Availability..." -ForegroundColor Yellow
$functionAppId = az functionapp show `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --query id -o tsv

az monitor metrics alert create `
    --name "SAXMegaMind-FunctionAppDown" `
    --resource-group $ResourceGroup `
    --scopes $functionAppId `
    --condition "avg Health < 1" `
    --window-size 5m `
    --evaluation-frequency 1m `
    --severity 1 `
    --description "Alert when Function App is unavailable"

# Alert 4: Storage Account Issues
Write-Host "Creating alert: Storage Operation Failures..." -ForegroundColor Yellow
az monitor scheduled-query create `
    --name "SAXMegaMind-StorageFailures" `
    --resource-group $ResourceGroup `
    --scopes $appInsightsId `
    --condition "count > 5" `
    --query "dependencies | where type == 'Azure blob' and success == false" `
    --window-size 5m `
    --evaluation-frequency 1m `
    --severity 2 `
    --description "Alert when storage operations fail"

# Alert 5: Search Index Issues
Write-Host "Creating alert: Search Index Failures..." -ForegroundColor Yellow
az monitor scheduled-query create `
    --name "SAXMegaMind-SearchFailures" `
    --resource-group $ResourceGroup `
    --scopes $appInsightsId `
    --condition "count > 5" `
    --query "dependencies | where name contains 'search.windows.net' and success == false" `
    --window-size 5m `
    --evaluation-frequency 1m `
    --severity 2 `
    --description "Alert when search operations fail"

Write-Host ""
Write-Host "✓ Alerts created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Created Alerts:" -ForegroundColor Cyan
Write-Host "• High Error Rate (>10%)" -ForegroundColor White
Write-Host "• Slow Response Time (>5s)" -ForegroundColor White
Write-Host "• Function App Availability" -ForegroundColor White
Write-Host "• Storage Operation Failures" -ForegroundColor White
Write-Host "• Search Index Failures" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure action groups for alert notifications" -ForegroundColor White
Write-Host "2. Set up email/SMS/webhook notifications" -ForegroundColor White
Write-Host "3. Create dashboards in Azure Portal" -ForegroundColor White
Write-Host "4. Review alerts regularly and tune thresholds" -ForegroundColor White
