# Generate MODS_ENCRYPTION_KEY for Mods Hub
# This script generates a cryptographically secure encryption key
# compatible with the MODS_ENCRYPTION_KEY requirement (minimum 32 characters)

Write-Host "Generating MODS_ENCRYPTION_KEY..." -ForegroundColor Cyan
Write-Host ""

# Generate a secure random key using 32 bytes (256 bits) for AES-256 encryption
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$base64Key = [Convert]::ToBase64String($bytes)

# Alternative formats
$hexKey = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
$urlSafeKey = [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')

Write-Host "Generated Keys:" -ForegroundColor Green
Write-Host ""
Write-Host 'Base64 (44 chars):' -ForegroundColor Yellow
Write-Host $base64Key -ForegroundColor White
Write-Host ""
Write-Host 'Hex (64 chars):' -ForegroundColor Yellow
Write-Host $hexKey -ForegroundColor White
Write-Host ""
Write-Host 'URL-Safe Base64 (44 chars):' -ForegroundColor Yellow
Write-Host $urlSafeKey -ForegroundColor White
Write-Host ""

# Validate lengths
Write-Host "Validation:" -ForegroundColor Cyan
if ($base64Key.Length -ge 32) {
    Write-Host "  Base64 length: $($base64Key.Length) characters" -ForegroundColor Green
} else {
    Write-Host "  Base64 length: $($base64Key.Length) characters" -ForegroundColor Red
}
if ($hexKey.Length -ge 32) {
    Write-Host "  Hex length: $($hexKey.Length) characters" -ForegroundColor Green
} else {
    Write-Host "  Hex length: $($hexKey.Length) characters" -ForegroundColor Red
}
if ($urlSafeKey.Length -ge 32) {
    Write-Host "  URL-Safe length: $($urlSafeKey.Length) characters" -ForegroundColor Green
} else {
    Write-Host "  URL-Safe length: $($urlSafeKey.Length) characters" -ForegroundColor Red
}
Write-Host ""

# Recommended key (Base64 is most compatible)
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "RECOMMENDED KEY (Base64) - Copy this value:" -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host $base64Key -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Copy the key above (between the lines)" -ForegroundColor White
Write-Host "2. Add it to GitHub Secrets as MODS_ENCRYPTION_KEY" -ForegroundColor White
Write-Host "3. Add it to Cloudflare Worker secrets (mods-api worker)" -ForegroundColor White
Write-Host "4. Keep this key secure - it's used for file encryption!" -ForegroundColor Yellow
Write-Host ""

# Also output just the key on its own line for easy selection
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Yellow
Write-Host "COPY THIS KEY VALUE:" -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Yellow
Write-Output $base64Key
Write-Host "===============================================================" -ForegroundColor Yellow
Write-Host ""
