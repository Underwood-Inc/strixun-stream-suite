# Packages Reorganization Script
# Moves all libraries to packages/ directory

Write-Host "[INFO] Starting packages reorganization..." -ForegroundColor Cyan

# Create packages directory if it doesn't exist
if (-not (Test-Path "packages")) {
    New-Item -ItemType Directory -Path "packages" | Out-Null
    Write-Host "[SUCCESS] Created packages/ directory" -ForegroundColor Green
}

# Function to move directory and update paths
function Move-Package {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [string]$PackageName
    )
    
    Write-Host "[INFO] Moving $PackageName from $SourcePath to $DestPath..." -ForegroundColor Yellow
    
    if (Test-Path $SourcePath) {
        Copy-Item -Path $SourcePath -Destination $DestPath -Recurse -Force
        Write-Host "[SUCCESS] Copied $PackageName" -ForegroundColor Green
        return $true
    } else {
        Write-Host "[WARNING] Source path not found: $SourcePath" -ForegroundColor Yellow
        return $false
    }
}

# Move serverless libraries
Write-Host "`n[INFO] Moving serverless libraries..." -ForegroundColor Cyan
Move-Package "serverless\shared\api" "packages\api-framework" "@strixun/api-framework"
Move-Package "serverless\shared\encryption" "packages\encryption" "@strixun/encryption"
Move-Package "serverless\shared\service-client" "packages\service-client" "@strixun/service-client"

# Move types (special handling - files are in parent)
Write-Host "`n[INFO] Moving types library..." -ForegroundColor Cyan
if (Test-Path "serverless\shared\types") {
    New-Item -ItemType Directory -Path "packages\types" -Force | Out-Null
    Copy-Item -Path "serverless\shared\types.ts" -Destination "packages\types\index.ts" -Force
    Copy-Item -Path "serverless\shared\types.js" -Destination "packages\types\index.js" -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "serverless\shared\types.js.map" -Destination "packages\types\index.js.map" -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "serverless\shared\types\package.json" -Destination "packages\types\package.json" -Force
    Write-Host "[SUCCESS] Moved @strixun/types" -ForegroundColor Green
}

# Move component libraries
Write-Host "`n[INFO] Moving component libraries..." -ForegroundColor Cyan
$componentLibraries = @(
    "otp-login",
    "search-query-parser",
    "virtualized-table",
    "rate-limit-info",
    "status-flair",
    "tooltip",
    "ad-carousel",
    "error-mapping",
    "idle-game-overlay"
)

foreach ($lib in $componentLibraries) {
    $sourcePath = "shared-components\$lib"
    $destPath = "packages\$lib"
    Move-Package $sourcePath $destPath "@strixun/$lib"
}

Write-Host "`n[SUCCESS] All packages moved to packages/ directory" -ForegroundColor Green
Write-Host "[INFO] Next steps:" -ForegroundColor Cyan
Write-Host "  1. Update path references in moved packages" -ForegroundColor Yellow
Write-Host "  2. Update pnpm-workspace.yaml" -ForegroundColor Yellow
Write-Host "  3. Update all import statements" -ForegroundColor Yellow
Write-Host "  4. Run pnpm install" -ForegroundColor Yellow

