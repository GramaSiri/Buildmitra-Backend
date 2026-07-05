param(
    [int]$PlotWidth = 30,
    [int]$PlotDepth = 40,
    [int]$Bedrooms = 3,
    [bool]$Vaastu = $true
)

function Invoke-FloorplanAPI {
    param(
        [int]$plotWidth,
        [int]$plotDepth,
        [int]$bedrooms,
        [bool]$vaastu
    )
    
    $uri = "http://localhost:5000/api/floorplan/generate"
    
    $body = @{
        plotWidth = $plotWidth
        plotDepth = $plotDepth
        bedrooms = $bedrooms
        vaastu = $vaastu
    } | ConvertTo-Json
    
    Write-Host "Calling API at $uri" -ForegroundColor Cyan
    Write-Host "Request Body: $body" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop
        
        if ($response.success -eq $true) {
            Write-Host "`n✓ SUCCESS: $($response.message)" -ForegroundColor Green
            Write-Host "`n--- Response Data ---" -ForegroundColor Cyan
            $response.data | ConvertTo-Json -Depth 10
            return $response
        }
        else {
            Write-Host "✗ ERROR: $($response.message)" -ForegroundColor Red
            return $null
        }
    }
    catch {
        Write-Host "`n✗ FAILED to call API" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Test-ServerStatus {
    Write-Host "`n--- Checking Server Status ---" -ForegroundColor Cyan
    
    try {
        $test = Invoke-RestMethod -Uri "http://localhost:5000" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "✓ Backend server on port 5000 is RUNNING" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "✗ Backend server on port 5000 is NOT RUNNING" -ForegroundColor Red
        return $false
    }
}

function Invoke-TestSuite {
    Write-Host "`n========== RUNNING TEST SUITE ==========" -ForegroundColor Magenta
    
    Write-Host "`n--- Test 1: Default Configuration ---" -ForegroundColor Cyan
    Invoke-FloorplanAPI -plotWidth 30 -plotDepth 40 -bedrooms 3 -vaastu $true
    
    Write-Host "`n--- Test 2: 2 Bedrooms ---" -ForegroundColor Cyan
    Invoke-FloorplanAPI -plotWidth 25 -plotDepth 35 -bedrooms 2 -vaastu $false
    
    Write-Host "`n--- Test 3: Large Plot ---" -ForegroundColor Cyan
    Invoke-FloorplanAPI -plotWidth 50 -plotDepth 60 -bedrooms 4 -vaastu $true
    
    Write-Host "`n========== TEST SUITE COMPLETE ==========" -ForegroundColor Magenta
}

function Invoke-SingleCall {
    Write-Host "`n--- Making API Call ---" -ForegroundColor Cyan
    $result = Invoke-FloorplanAPI -plotWidth $PlotWidth -plotDepth $PlotDepth -bedrooms $Bedrooms -vaastu $Vaastu
    
    if ($result) {
        Write-Host "`n✓ API Call Successful!" -ForegroundColor Green
    }
}

function Show-Menu {
    Write-Host "`n========== FLOORPLAN API TOOL ==========" -ForegroundColor Cyan
    Write-Host "1. Make Single API Call" -ForegroundColor White
    Write-Host "2. Run Test Suite (3 tests)" -ForegroundColor White
    Write-Host "3. Check Server Status" -ForegroundColor White
    Write-Host "4. Custom API Call" -ForegroundColor White
    Write-Host "5. Exit" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Cyan
    
    $choice = Read-Host "`nEnter your choice (1-5)"
    
    switch ($choice) {
        "1" { Invoke-SingleCall }
        "2" { Invoke-TestSuite }
        "3" { Test-ServerStatus }
        "4" { 
            $w = Read-Host "Enter plot width (default 30)"
            $d = Read-Host "Enter plot depth (default 40)"
            $b = Read-Host "Enter bedrooms (default 3)"
            $v = Read-Host "Use Vaastu? (true/false, default true)"
            
            $width = if ($w) { [int]$w } else { 30 }
            $depth = if ($d) { [int]$d } else { 40 }
            $bed = if ($b) { [int]$b } else { 3 }
            $vast = if ($v) { [bool]::Parse($v) } else { $true }
            
            Invoke-FloorplanAPI -plotWidth $width -plotDepth $depth -bedrooms $bed -vaastu $vast
        }
        "5" { Write-Host "Exiting..." -ForegroundColor Yellow; exit }
        default { Write-Host "Invalid choice!" -ForegroundColor Red }
    }
}

Clear-Host
Show-Menu

while ($true) {
    $continue = Read-Host "`nPress Enter to return to menu or 'q' to quit"
    if ($continue -eq 'q') { break }
    Clear-Host
    Show-Menu
}
