$body = @{
    plotWidth = 30
    plotDepth = 40
    bedrooms = 3
    vaastu = $true
} | ConvertTo-Json

Write-Host "Testing API at http://localhost:5000/api/floorplan/generate" -ForegroundColor Cyan
Write-Host "Request body: $body" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/floorplan/generate" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Message: $($response.message)" -ForegroundColor Yellow
    Write-Host "`nData:" -ForegroundColor Cyan
    $response.data | ConvertTo-Json -Depth 10
} 
catch {
    Write-Host "`n❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    
    # Check if server is running
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:5000" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "✓ Server is running on port 5000" -ForegroundColor Green
    } catch {
        Write-Host "✗ Server is NOT running on port 5000" -ForegroundColor Red
        Write-Host "`nPlease start your server first with: npm start" -ForegroundColor Yellow
    }
}
