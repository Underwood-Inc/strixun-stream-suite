#!/usr/bin/env pwsh
# Clear Local KV Storage for Mods API
# This ensures complete isolation from production data

$wranglerStatePath = "$env:USERPROFILE\.wrangler\state\v3"

Write-Host "ℹ Checking for local wrangler state..." -ForegroundColor Cyan

if (Test-Path $wranglerStatePath) {
    Write-Host "⚠ Local wrangler state found at: $wranglerStatePath" -ForegroundColor Yellow
    Write-Host "ℹ This may contain production data if you previously ran without --local flag" -ForegroundColor Yellow
    
    $response = Read-Host "Do you want to clear all local KV and R2 storage? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "ℹ Clearing local storage..." -ForegroundColor Cyan
        Remove-Item $wranglerStatePath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Local storage cleared!" -ForegroundColor Green
        Write-Host "ℹ Restart your dev servers (pnpm dev:all) to start with fresh local storage" -ForegroundColor Cyan
    } else {
        Write-Host "ℹ Skipped clearing local storage" -ForegroundColor Yellow
    }
} else {
    Write-Host "ℹ No local wrangler state found - this is normal for first run" -ForegroundColor Green
    Write-Host "ℹ Local storage will be created automatically when you run wrangler dev --local" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "ℹ To verify local isolation:" -ForegroundColor Cyan
Write-Host "  1. Make sure all dev scripts use --local flag" -ForegroundColor White
Write-Host "  2. Check package.json: 'dev': 'wrangler dev --port 8788 --local'" -ForegroundColor White
Write-Host "  3. After clearing, restart dev servers" -ForegroundColor White
Write-Host "  4. Upload a test mod - it should only appear in local dev, not production" -ForegroundColor White

