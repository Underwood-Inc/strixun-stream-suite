# PowerShell script to set all encryption keys for frontend and backend
# Usage: .\set-all-encryption-keys.ps1

Write-Host "[EMOJI] Setting all encryption keys for frontend and backend..." -ForegroundColor Cyan
Write-Host ""

# Prompt for SERVICE_ENCRYPTION_KEY (used for OTP encryption)
$serviceEncryptionKey = Read-Host "Enter SERVICE_ENCRYPTION_KEY (input will be hidden)" -AsSecureString
$serviceEncryptionKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($serviceEncryptionKey))

if ([string]::IsNullOrWhiteSpace($serviceEncryptionKeyPlain)) {
    Write-Host "[ERROR] Error: Key cannot be empty" -ForegroundColor Red
    exit 1
}

if ($serviceEncryptionKeyPlain.Length -lt 32) {
    Write-Host "[ERROR] Error: Key must be at least 32 characters" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Prompt for SERVICE_API_KEY (used for service-to-service auth)
Write-Host "Enter SERVICE_API_KEY for service-to-service authentication (customer-api calls)" -ForegroundColor Yellow
$serviceApiKey = Read-Host "Enter SERVICE_API_KEY (input will be hidden)" -AsSecureString
$serviceApiKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($serviceApiKey))

if ([string]::IsNullOrWhiteSpace($serviceApiKeyPlain)) {
    Write-Host "[WARNING] SERVICE_API_KEY is empty. Customer API calls will fail with 401." -ForegroundColor Yellow
    Write-Host "Do you want to continue without SERVICE_API_KEY? (y/n)" -ForegroundColor Yellow
    $continue = Read-Host
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

Write-Host ""
Write-Host "Setting keys..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

# List of frontend apps that need VITE_SERVICE_ENCRYPTION_KEY
$frontendApps = @(
    @{ Path = "."; Name = "Root" },
    @{ Path = "mods-hub"; Name = "Mods Hub" },
    @{ Path = "serverless\url-shortener\app"; Name = "URL Shortener App" },
    @{ Path = "serverless\otp-auth-service\dashboard"; Name = "OTP Auth Dashboard" }
)

# Set VITE_SERVICE_ENCRYPTION_KEY in frontend .env files
Write-Host "Setting VITE_SERVICE_ENCRYPTION_KEY in frontend .env files..." -ForegroundColor Cyan
foreach ($app in $frontendApps) {
    $envPath = Join-Path $app.Path ".env"
    $fullPath = Resolve-Path -Path $envPath -ErrorAction SilentlyContinue
    
    if (-not $fullPath) {
        # Try relative to script location
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $fullPath = Join-Path $scriptDir "..\$($app.Path)\.env"
    }
    
    $dir = Split-Path -Parent $fullPath
    if (-not (Test-Path $dir)) {
        Write-Host "  [WARNING] Skipping $($app.Name) (directory not found: $dir)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "  Setting key in $($app.Name)..." -ForegroundColor Gray
    
    # Read existing .env file if it exists
    $envContent = ""
    if (Test-Path $fullPath) {
        $envContent = Get-Content $fullPath -Raw
    }
    
    # Update or add VITE_SERVICE_ENCRYPTION_KEY
    if ($envContent -match "VITE_SERVICE_ENCRYPTION_KEY\s*=") {
        $envContent = $envContent -replace "VITE_SERVICE_ENCRYPTION_KEY\s*=.*", "VITE_SERVICE_ENCRYPTION_KEY=$serviceEncryptionKeyPlain"
    } else {
        if ($envContent -and -not $envContent.EndsWith("`n") -and -not $envContent.EndsWith("`r`n")) {
            $envContent += "`r`n"
        }
        $envContent += "VITE_SERVICE_ENCRYPTION_KEY=$serviceEncryptionKeyPlain`r`n"
    }
    
    try {
        Set-Content -Path $fullPath -Value $envContent -NoNewline
        Write-Host "    [OK] $($app.Name)" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "    [ERROR] Failed: $_" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""

# List of workers that need SERVICE_ENCRYPTION_KEY
$workers = @(
    "otp-auth-service",
    "customer-api",
    "game-api",
    "chat-signaling",
    "mods-api",
    "url-shortener",
    "twitch-api"
)

# Set SERVICE_ENCRYPTION_KEY in workers
Write-Host "Setting SERVICE_ENCRYPTION_KEY in workers..." -ForegroundColor Cyan
foreach ($worker in $workers) {
    $workerPath = Join-Path "serverless" $worker
    
    if (-not (Test-Path $workerPath)) {
        Write-Host "  [WARNING] Skipping $worker (directory not found)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "  Setting key in $worker..." -ForegroundColor Gray
    
    Push-Location $workerPath
    try {
        $serviceEncryptionKeyPlain | wrangler secret put SERVICE_ENCRYPTION_KEY
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    [OK] $worker" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "    [ERROR] Failed to set SERVICE_ENCRYPTION_KEY in $worker" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "    [ERROR] Failed: $_" -ForegroundColor Red
        $failCount++
    } finally {
        Pop-Location
    }
}

Write-Host ""

# Set SERVICE_API_KEY in workers that need it
if (-not [string]::IsNullOrWhiteSpace($serviceApiKeyPlain)) {
    Write-Host "Setting SERVICE_API_KEY in workers..." -ForegroundColor Cyan
    $serviceWorkers = @(
        "otp-auth-service",
        "customer-api"
    )
    
    foreach ($worker in $serviceWorkers) {
        $workerPath = Join-Path "serverless" $worker
        
        if (-not (Test-Path $workerPath)) {
            Write-Host "  [WARNING] Skipping $worker (directory not found)" -ForegroundColor Yellow
            continue
        }
        
        Write-Host "  Setting SERVICE_API_KEY in $worker..." -ForegroundColor Gray
        
        Push-Location $workerPath
        try {
            $serviceApiKeyPlain | wrangler secret put SERVICE_API_KEY
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    [OK] $worker" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "    [ERROR] Failed to set SERVICE_API_KEY in $worker" -ForegroundColor Red
                $failCount++
            }
        } catch {
            Write-Host "    [ERROR] Failed: $_" -ForegroundColor Red
            $failCount++
        } finally {
            Pop-Location
        }
    }
    Write-Host ""
}

Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  [OK] Success: $successCount" -ForegroundColor Green
Write-Host "  [ERROR] Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "[OK] All keys configured successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Rebuild frontend apps: cd serverless/url-shortener && pnpm build:app" -ForegroundColor Gray
    Write-Host "  2. Rebuild mods-hub if needed: cd mods-hub && pnpm build" -ForegroundColor Gray
    Write-Host "  3. Rebuild OTP dashboard if needed: cd serverless/otp-auth-service/dashboard && pnpm build" -ForegroundColor Gray
} else {
    Write-Host "[WARNING] Some keys failed to set. Please check the errors above." -ForegroundColor Yellow
}

