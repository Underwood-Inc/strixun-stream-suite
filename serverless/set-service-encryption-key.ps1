# PowerShell script to set SERVICE_ENCRYPTION_KEY in all workers
# Usage: .\set-service-encryption-key.ps1

Write-Host "Setting SERVICE_ENCRYPTION_KEY for all workers..." -ForegroundColor Cyan
Write-Host ""

# Prompt for the key (hidden input)
$secureKey = Read-Host "Enter SERVICE_ENCRYPTION_KEY (input will be hidden)" -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
)

if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Host "[ERROR] Key cannot be empty" -ForegroundColor Red
    exit 1
}

if ($key.Length -lt 32) {
    Write-Host "[ERROR] Key must be at least 32 characters" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Setting key in all workers..." -ForegroundColor Yellow
Write-Host ""

# List of workers
$workers = @(
    "otp-auth-service",
    "customer-api",
    "game-api",
    "chat-signaling",
    "mods-api",
    "url-shortener",
    "twitch-api"
)

$successCount = 0
$failCount = 0

foreach ($worker in $workers) {
    $workerPath = "$worker"
    
    if (-not (Test-Path $workerPath)) {
        Write-Host "[WARN] Skipping $worker (directory not found)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "Setting key in $worker..." -ForegroundColor Cyan
    
    # Change to worker directory
    Push-Location $workerPath
    
    try {
        # Use wrangler secret put with echo to provide the key
        $key | wrangler secret put SERVICE_ENCRYPTION_KEY 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [SUCCESS]" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "  [FAILED] Exit code: $LASTEXITCODE" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "  [ERROR] $_" -ForegroundColor Red
        $failCount++
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "All workers configured successfully!" -ForegroundColor Green
} else {
    Write-Host "Some workers failed. Please check the errors above." -ForegroundColor Yellow
}

