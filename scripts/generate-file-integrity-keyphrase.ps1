# Generate FILE_INTEGRITY_KEYPHRASE for Mods API
# This script generates a cryptographically secure keyphrase
# for HMAC-SHA256 file integrity verification
# This is a SERVER-SIDE ONLY secret that prevents hash spoofing

Write-Host "Generating FILE_INTEGRITY_KEYPHRASE..." -ForegroundColor Cyan
Write-Host ""
Write-Host "This keyphrase is used for HMAC-SHA256 file integrity verification." -ForegroundColor Yellow
Write-Host "It is SERVER-SIDE ONLY and prevents hash spoofing attacks." -ForegroundColor Yellow
Write-Host ""

# Generate a secure random keyphrase using 32 bytes (256 bits)
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$base64Keyphrase = [Convert]::ToBase64String($bytes)

# Alternative formats
$hexKeyphrase = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
$urlSafeKeyphrase = [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')

Write-Host "Generated Keyphrases:" -ForegroundColor Green
Write-Host ""
Write-Host 'Base64 (44 chars):' -ForegroundColor Yellow
Write-Host $base64Keyphrase -ForegroundColor White
Write-Host ""
Write-Host 'Hex (64 chars):' -ForegroundColor Yellow
Write-Host $hexKeyphrase -ForegroundColor White
Write-Host ""
Write-Host 'URL-Safe Base64 (44 chars):' -ForegroundColor Yellow
Write-Host $urlSafeKeyphrase -ForegroundColor White
Write-Host ""

# Validate lengths
Write-Host "Validation:" -ForegroundColor Cyan
Write-Host "  Base64 length: $($base64Keyphrase.Length) characters" -ForegroundColor Green
Write-Host "  Hex length: $($hexKeyphrase.Length) characters" -ForegroundColor Green
Write-Host "  URL-Safe length: $($urlSafeKeyphrase.Length) characters" -ForegroundColor Green
Write-Host ""

# Recommended keyphrase (Base64 is most compatible)
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "RECOMMENDED KEYPHRASE (Base64) - Copy this value:" -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host $base64Keyphrase -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Copy the keyphrase above (between the lines)" -ForegroundColor White
Write-Host "2. Add it to GitHub Secrets as FILE_INTEGRITY_KEYPHRASE" -ForegroundColor White
Write-Host "3. Add it to Cloudflare Worker secrets (mods-api worker)" -ForegroundColor White
Write-Host "4. CRITICAL: This is SERVER-SIDE ONLY - never expose in frontend!" -ForegroundColor Red
Write-Host "5. Keep this keyphrase secure - it prevents hash spoofing!" -ForegroundColor Yellow
Write-Host ""

# Also output just the keyphrase on its own line for easy selection
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Yellow
Write-Host "COPY THIS KEYPHRASE VALUE:" -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Yellow
Write-Output $base64Keyphrase
Write-Host "===============================================================" -ForegroundColor Yellow
Write-Host ""
