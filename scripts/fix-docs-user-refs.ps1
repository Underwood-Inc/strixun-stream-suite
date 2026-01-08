#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Fix all user→customer references in documentation
.DESCRIPTION
    Targeted replacement in specific documentation directories
#>

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Fixing user->customer references in documentation..." -ForegroundColor Cyan
Write-Host ""

# Target specific documentation directories
$targetDirs = @(
    "serverless\otp-auth-service\docs",
    "serverless\mods-api\docs",
    "mods-hub\docs",
    "packages\docs",
    "╠═══════ PANDA_CORE ═══════╣"
)

# Pattern replacements for documentation
$replacements = @(
    @{ Pattern = '\bUserListItem\b'; Replacement = 'CustomerListItem' }
    @{ Pattern = '\bUserDetail\b'; Replacement = 'CustomerDetail' }
    @{ Pattern = '\bUserResponse\b'; Replacement = 'CustomerResponse' }
    @{ Pattern = '\bUserListResponse\b'; Replacement = 'CustomerListResponse' }
    @{ Pattern = '/admin/users'; Replacement = '/admin/customers' }
    @{ Pattern = '\blistUsers\b'; Replacement = 'listCustomers' }
    @{ Pattern = '\bgetUserDetails\b'; Replacement = 'getCustomerDetails' }
    @{ Pattern = '\bupdateUser\b'; Replacement = 'updateCustomer' }
    @{ Pattern = '\bgetUserMods\b'; Replacement = 'getCustomerMods' }
    @{ Pattern = '\buserId\b'; Replacement = 'customerId' }
    @{ Pattern = '\buser_id\b'; Replacement = 'customer_id' }
    @{ Pattern = 'user management'; Replacement = 'customer management' }
    @{ Pattern = 'User management'; Replacement = 'Customer management' }
    @{ Pattern = 'user account'; Replacement = 'customer account' }
    @{ Pattern = 'User account'; Replacement = 'Customer account' }
    @{ Pattern = 'user session'; Replacement = 'customer session' }
    @{ Pattern = 'User session'; Replacement = 'Customer session' }
    @{ Pattern = 'User ID'; Replacement = 'Customer ID' }
    @{ Pattern = 'user ID'; Replacement = 'customer ID' }
    @{ Pattern = 'authenticated user'; Replacement = 'authenticated customer' }
    @{ Pattern = 'max users'; Replacement = 'max customers' }
    @{ Pattern = 'active users'; Replacement = 'active customers' }
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
    
    $files = Get-ChildItem -Path $fullPath -Include *.md,*.txt -Recurse -File -ErrorAction SilentlyContinue
    
    foreach ($file in $files) {
        try {
            $content = [System.IO.File]::ReadAllText($file.FullName)
            $originalContent = $content
            $changesInFile = 0
            
            foreach ($replacement in $replacements) {
                if ($content -match $replacement.Pattern) {
                    $content = $content -replace $replacement.Pattern, $replacement.Replacement
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
