# Clear Wrangler Cache Script
# Removes .wrangler directories to fix build/cache issues

Write-Host "[INFO] Clearing Wrangler cache directories..." -ForegroundColor Cyan

$wranglerDirs = Get-ChildItem -Path . -Recurse -Directory -Filter ".wrangler" -ErrorAction SilentlyContinue

if ($wranglerDirs.Count -eq 0) {
    Write-Host "[INFO] No .wrangler directories found" -ForegroundColor Green
} else {
    Write-Host "[INFO] Found $($wranglerDirs.Count) .wrangler directory(ies)" -ForegroundColor Yellow
    
    foreach ($dir in $wranglerDirs) {
        Write-Host "  Removing: $($dir.FullName)" -ForegroundColor Gray
        Remove-Item -Path $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "[SUCCESS] Cleared all .wrangler cache directories" -ForegroundColor Green
}

Write-Host ""
Write-Host "[INFO] Next steps:" -ForegroundColor Cyan
Write-Host "  1. Stop all wrangler dev processes" -ForegroundColor White
Write-Host "  2. Restart dev servers: cd mods-hub && pnpm dev:all" -ForegroundColor White

