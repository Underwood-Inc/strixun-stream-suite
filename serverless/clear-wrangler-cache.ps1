# Clear Wrangler Cache Script
# Removes .wrangler directories to fix build/cache issues

Write-Host "ℹ Clearing Wrangler cache directories..." -ForegroundColor Cyan

$wranglerDirs = Get-ChildItem -Path . -Recurse -Directory -Filter ".wrangler" -ErrorAction SilentlyContinue

if ($wranglerDirs.Count -eq 0) {
    Write-Host "ℹ No .wrangler directories found" -ForegroundColor Green
} else {
    Write-Host "ℹ Found $($wranglerDirs.Count) .wrangler directory(ies)" -ForegroundColor Yellow
    
    foreach ($dir in $wranglerDirs) {
        Write-Host "  Removing: $($dir.FullName)" -ForegroundColor Gray
        Remove-Item -Path $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "✓ Cleared all .wrangler cache directories" -ForegroundColor Green
}

Write-Host ""
Write-Host "ℹ Next steps:" -ForegroundColor Cyan
Write-Host "  1. Stop all wrangler dev processes" -ForegroundColor White
Write-Host "  2. Restart dev servers: cd mods-hub && pnpm dev:all" -ForegroundColor White

