#!/usr/bin/env pwsh
# Clear All Local KV Storage
# This script removes all local KV data to start fresh for integration tests

$wranglerStatePath = "$env:USERPROFILE\.wrangler\state\v3\kv"

Write-Host "Clearing all local KV storage..." -ForegroundColor Cyan
Write-Host "   Path: $wranglerStatePath" -ForegroundColor Gray

if (Test-Path $wranglerStatePath) {
    try {
        Remove-Item $wranglerStatePath -Recurse -Force -ErrorAction Stop
        Write-Host "All local KV storage cleared!" -ForegroundColor Green
        Write-Host "   Local KV will be recreated on next wrangler dev --local run" -ForegroundColor Gray
    } catch {
        Write-Host "Failed to clear KV storage: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "No local KV storage found - nothing to clear" -ForegroundColor Yellow
    Write-Host "   This is normal if you haven't run wrangler dev --local yet" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "   1. Restart your dev servers (if running)" -ForegroundColor White
Write-Host "   2. Run integration tests - they will start with fresh KV storage" -ForegroundColor White
