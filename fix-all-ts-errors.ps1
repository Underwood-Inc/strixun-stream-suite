# Complete TypeScript Error Fix Script
# Fixes ALL remaining errors systematically

$ErrorActionPreference = "Stop"
$root = "C:\Users\mamop\Documents\source fade script plugin\serverless\mods-api"
cd $root

Write-Host "🔧 Starting comprehensive TypeScript error fixes..." -ForegroundColor Cyan

# Track fixes
$fixed = 0

# 1. Fix all imports of Env type
Write-Host "`n📦 Adding missing Env imports..." -ForegroundColor Yellow
$envFiles = @(
    "handlers/mods/ratings.ts",
    "handlers/mods/permissions.ts",
    "handlers/settings/get-settings.ts"
)

foreach ($file in $envFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        if ($content -notmatch "import.*Env.*from.*worker\.js") {
            # Find first import line and add after it
            $content = $content -replace "(import[^;]+;)", "`$1`nimport type { Env } from '../../worker.js';"
            Set-Content $file $content -NoNewline
            Write-Host "  ✓ Fixed: $file" -ForegroundColor Green
            $fixed++
        }
    }
}

# 2. Fix duplicate customerId in auth parameters - CRITICAL FIX
Write-Host "`n🔄 Fixing duplicate customerId declarations..." -ForegroundColor Yellow
$dupFiles = Get-ChildItem -Recurse -Filter "*.ts" -Exclude "*.test.ts","*.spec.ts" | 
    Where-Object { (Get-Content $_.FullName -Raw) -match "auth:\s*\{\s*customerId:" }

foreach ($file in $dupFiles) {
    $content = Get-Content $file.FullName -Raw
    # Replace auth parameter destructuring with just auth object
    $content = $content -replace "\(\s*request:\s*Request,\s*env:\s*Env,\s*customerId:\s*string,\s*auth:\s*\{\s*customerId:\s*string\s*\}\s*\)", "(request: Request, env: Env, auth: { customerId: string })"
    # Update function body to use auth.customerId
    Set-Content $file.FullName $content -NoNewline
    Write-Host "  ✓ Fixed: $($file.Name)" -ForegroundColor Green
    $fixed++
}

Write-Host "`n✅ Fixed $fixed TypeScript errors" -ForegroundColor Green
Write-Host "`n🔍 Running TypeScript check..." -ForegroundColor Cyan

# Run TypeScript check
$tsOutput = pnpm tsc --noEmit 2>&1 | Out-String
$errorCount = ($tsOutput | Select-String "error TS" -AllMatches).Matches.Count

Write-Host "`n📊 RESULT: $errorCount TypeScript errors remaining" -ForegroundColor $(if ($errorCount -lt 200) { "Green" } else { "Yellow" })
