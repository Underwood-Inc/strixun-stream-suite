#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Fix all user→customer references in src/ directories
.DESCRIPTION
    Comprehensive replacement targeting src/ directories across the codebase
#>

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Fixing user->customer references in src/ directories..." -ForegroundColor Cyan
Write-Host ""

# Target directories with src/ folders
$targetDirs = @(
    "serverless\otp-auth-service\src",
    "packages"
)

# Pattern replacements (order matters - most specific first)
$replacements = @(
    # Type names
    @{ Pattern = '\bUserResponse\b'; Replacement = 'CustomerResponse' }
    @{ Pattern = '\bUserListItem\b'; Replacement = 'CustomerListItem' }
    @{ Pattern = '\bUserDetail\b'; Replacement = 'CustomerDetail' }
    
    # Function names
    @{ Pattern = '\bgetCurrentUser\b'; Replacement = 'getCurrentCustomer' }
    @{ Pattern = '\bauthenticateUser\b'; Replacement = 'authenticateCustomer' }
    
    # Variable patterns
    @{ Pattern = '\buserId:\s*string'; Replacement = 'customerId: string' }
    @{ Pattern = '\buserId\?:\s*string'; Replacement = 'customerId?: string' }
    @{ Pattern = '\.userId\b'; Replacement = '.customerId' }
    @{ Pattern = '\buser\.email\b'; Replacement = 'customer.email' }
    @{ Pattern = '\buser\?\.email\b'; Replacement = 'customer?.email' }
    @{ Pattern = '\buser\?\.displayName\b'; Replacement = 'customer?.displayName' }
    
    # HTML attributes and IDs
    @{ Pattern = 'user-email'; Replacement = 'customer-email' }
    @{ Pattern = '"user"'; Replacement = '"customer"' }
    @{ Pattern = "'user'"; Replacement = "'customer'" }
    
    # Store and state patterns
    @{ Pattern = 'state\.user\b'; Replacement = 'state.customer' }
    @{ Pattern = '\.user\?\.'; Replacement = '.customer?.' }
    
    # Comments and strings (be selective)
    @{ Pattern = 'Your users'; Replacement = 'Your customers' }
    @{ Pattern = 'max users'; Replacement = 'max customers' }
    @{ Pattern = 'Unlimited users'; Replacement = 'Unlimited customers' }
    @{ Pattern = 'active users'; Replacement = 'active customers' }
    @{ Pattern = 'User email'; Replacement = 'Customer email' }
    @{ Pattern = 'user email'; Replacement = 'customer email' }
)

$totalFixed = 0
$filesChanged = 0

foreach ($dir in $targetDirs) {
    $fullPath = Join-Path $repoRoot $dir
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "  Skipping $dir (not found)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "Scanning $dir..." -ForegroundColor Gray
    
    $files = Get-ChildItem -Path $fullPath -Include *.ts,*.tsx,*.js,*.jsx,*.svelte -Recurse -File |
        Where-Object { $_.FullName -notmatch 'node_modules|dist|build|coverage|\.next' }
    
    foreach ($file in $files) {
        try {
            $content = [System.IO.File]::ReadAllText($file.FullName)
            $originalContent = $content
            $changesInFile = 0
            
            foreach ($replacement in $replacements) {
                $pattern = $replacement.Pattern
                $newValue = $replacement.Replacement
                
                if ($content -match $pattern) {
                    $content = $content -replace $pattern, $newValue
                    $changesInFile++
                }
            }
            
            if ($content -ne $originalContent) {
                [System.IO.File]::WriteAllText($file.FullName, $content)
                $relativePath = $file.FullName.Replace($repoRoot + "\", "")
                Write-Host "  Updated: $relativePath ($changesInFile patterns)" -ForegroundColor Green
                $filesChanged++
                $totalFixed += $changesInFile
            }
        } catch {
            Write-Host "  ERROR: $($file.Name) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "COMPLETE: Fixed $totalFixed patterns in $filesChanged files" -ForegroundColor Green
Write-Host ""
