# Verify R2 is using local storage in dev
# This script checks that all dev scripts use --local flag

Write-Host "ℹ Verifying R2 local storage configuration..." -ForegroundColor Cyan
Write-Host ""

$allWorkers = @(
    "otp-auth-service",
    "mods-api",
    "twitch-api",
    "customer-api",
    "game-api",
    "chat-signaling",
    "url-shortener"
)

$issues = @()
$passed = 0

foreach ($worker in $allWorkers) {
    $packageJson = "serverless\$worker\package.json"
    
    if (Test-Path $packageJson) {
        $content = Get-Content $packageJson -Raw | ConvertFrom-Json
        
        if ($content.scripts.dev) {
            $devScript = $content.scripts.dev
            
            if ($devScript -match "--local") {
                Write-Host "✓ $worker : Uses --local flag" -ForegroundColor Green
                $passed++
            } else {
                Write-Host "✗ $worker : Missing --local flag in dev script" -ForegroundColor Red
                Write-Host "       Current: $devScript" -ForegroundColor Yellow
                $issues += "$worker dev script missing --local flag"
            }
        } else {
            Write-Host "⚠ $worker : No dev script found" -ForegroundColor Yellow
            $issues += "$worker has no dev script"
        }
    } else {
        Write-Host "⚠ $worker : package.json not found" -ForegroundColor Yellow
        $issues += "$worker package.json not found"
    }
}

Write-Host ""
Write-Host "ℹ Summary: $passed/$($allWorkers.Count) workers configured correctly" -ForegroundColor Cyan

if ($issues.Count -gt 0) {
    Write-Host ""
    Write-Host "✗ Issues found:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  - $issue" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "ℹ To fix: Add --local flag to dev scripts in package.json" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host ""
    Write-Host "✓ All workers are configured to use local R2 storage!" -ForegroundColor Green
    Write-Host "ℹ R2 files will be stored at: $env:USERPROFILE\.wrangler\state\v3\r2\" -ForegroundColor Cyan
    exit 0
}

