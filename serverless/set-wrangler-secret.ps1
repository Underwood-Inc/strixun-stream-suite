# PowerShell script to set any Wrangler secret across multiple services
# Usage: .\set-wrangler-secret.ps1
#
# This script:
# 1. Asks for the secret name
# 2. Asks for the secret value (hidden input, shows dots)
# 3. Discovers all services with wrangler.toml files
# 4. Asks which services to update (defaults to all)
# 5. Sets/updates the secret in each selected service

param(
    [string]$SecretName = "",
    [string]$Services = ""
)

# Function to get all services with wrangler.toml files
function Get-WranglerServices {
    $services = @()
    $basePath = $PSScriptRoot
    
    # Known service directories
    $serviceDirs = @(
        "otp-auth-service",
        "customer-api",
        "game-api",
        "chat-signaling",
        "mods-api",
        "url-shortener",
        "twitch-api"
    )
    
    foreach ($dir in $serviceDirs) {
        $servicePath = Join-Path $basePath $dir
        $wranglerPath = Join-Path $servicePath "wrangler.toml"
        if (Test-Path $wranglerPath) {
            $services += $dir
        }
    }
    
    return $services
}

# Function to read secure string with visual feedback (dots)
function Read-SecureStringWithDots {
    param(
        [string]$Prompt
    )
    
    Write-Host $Prompt -ForegroundColor Cyan
    Write-Host "(Input will be hidden, press Enter when done)" -ForegroundColor Gray
    
    $secureString = New-Object System.Security.SecureString
    $key = $null
    
    while ($key -ne [ConsoleKey]::Enter) {
        $keyInfo = [Console]::ReadKey($true)
        $key = $keyInfo.Key
        
        if ($key -eq [ConsoleKey]::Backspace) {
            if ($secureString.Length -gt 0) {
                $secureString.RemoveAt($secureString.Length - 1)
                Write-Host "`b `b" -NoNewline
            }
        }
        elseif ($key -ne [ConsoleKey]::Enter) {
            $secureString.AppendChar($keyInfo.KeyChar)
            Write-Host "*" -NoNewline -ForegroundColor DarkGray
        }
    }
    
    Write-Host "" # New line after input
    
    return $secureString
}

# Main script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Wrangler Secret Manager" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get secret name
if ([string]::IsNullOrWhiteSpace($SecretName)) {
    $SecretName = Read-Host "Enter the secret name (e.g., NETWORK_INTEGRITY_KEYPHRASE, JWT_SECRET, SERVICE_ENCRYPTION_KEY)"
}

if ([string]::IsNullOrWhiteSpace($SecretName)) {
    Write-Host "✗ Secret name cannot be empty" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Secret name: $SecretName" -ForegroundColor Green
Write-Host ""

# Step 2: Get secret value (hidden)
$secureValue = Read-SecureStringWithDots "Enter the secret value"
$secretValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
)

if ([string]::IsNullOrWhiteSpace($secretValue)) {
    Write-Host "✗ Secret value cannot be empty" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Secret value length: $($secretValue.Length) characters" -ForegroundColor Gray
Write-Host ""

# Step 3: Discover services
Write-Host "Discovering services with wrangler.toml..." -ForegroundColor Yellow
$allServices = Get-WranglerServices

if ($allServices.Count -eq 0) {
    Write-Host "✗ No services with wrangler.toml found" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($allServices.Count) service(s):" -ForegroundColor Green
for ($i = 0; $i -lt $allServices.Count; $i++) {
    Write-Host "  $($i + 1). $($allServices[$i])" -ForegroundColor Cyan
}
Write-Host ""

# Step 4: Select services
$selectedServices = @()

if (-not [string]::IsNullOrWhiteSpace($Services)) {
    # Services provided via parameter
    $serviceList = $Services -split ',' | ForEach-Object { $_.Trim() }
    foreach ($service in $serviceList) {
        if ($allServices -contains $service) {
            $selectedServices += $service
        } else {
            Write-Host "⚠ Service '$service' not found, skipping" -ForegroundColor Yellow
        }
    }
} else {
    # Interactive selection
    Write-Host "Select services to update:" -ForegroundColor Cyan
    Write-Host "  [Enter] = All services (default)" -ForegroundColor Gray
    Write-Host "  [1-$($allServices.Count)] = Specific service number" -ForegroundColor Gray
    Write-Host "  [1,2,3] = Multiple services (comma-separated)" -ForegroundColor Gray
    Write-Host ""
    
    $selection = Read-Host "Your selection"
    
    if ([string]::IsNullOrWhiteSpace($selection)) {
        # Default to all
        $selectedServices = $allServices
        Write-Host "Selected: All services" -ForegroundColor Green
    } else {
        # Parse selection
        $indices = $selection -split ',' | ForEach-Object { 
            $num = $_.Trim()
            if ($num -match '^\d+$') {
                [int]$num - 1
            }
        }
        
        foreach ($index in $indices) {
            if ($index -ge 0 -and $index -lt $allServices.Count) {
                $selectedServices += $allServices[$index]
            }
        }
        
        if ($selectedServices.Count -eq 0) {
            Write-Host "✗ No valid services selected" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "Selected services:" -ForegroundColor Green
        foreach ($service in $selectedServices) {
            Write-Host "  - $service" -ForegroundColor Cyan
        }
    }
}

Write-Host ""

# Step 5: Confirm
Write-Host "Ready to set secret '$SecretName' in $($selectedServices.Count) service(s)" -ForegroundColor Yellow
$confirm = Read-Host "Continue? (Y/n)"

if ($confirm -eq 'n' -or $confirm -eq 'N') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Setting secret in services..." -ForegroundColor Yellow
Write-Host ""

# Step 6: Set secrets
$successCount = 0
$failCount = 0
$basePath = $PSScriptRoot

foreach ($service in $selectedServices) {
    $servicePath = Join-Path $basePath $service
    
    if (-not (Test-Path $servicePath)) {
        Write-Host "⚠ Skipping $service (directory not found)" -ForegroundColor Yellow
        $failCount++
        continue
    }
    
    Write-Host "Setting secret in $service..." -ForegroundColor Cyan -NoNewline
    
    # Change to service directory
    Push-Location $servicePath
    
    try {
        # Use wrangler secret put with echo to provide the value
        # Wrangler automatically updates if the secret already exists
        $secretValue | wrangler secret put $SecretName 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✓" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host " ✗ Exit code: $LASTEXITCODE" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host " ✗ $_" -ForegroundColor Red
        $failCount++
    } finally {
        Pop-Location
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Secret name: $SecretName" -ForegroundColor White
Write-Host "  Services processed: $($selectedServices.Count)" -ForegroundColor White
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "✓ All services configured successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠ Some services failed. Please check the errors above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Note: Secrets are automatically updated if they already exist." -ForegroundColor Gray
Write-Host ""

