#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Fix all user→customer references in mods-api
.DESCRIPTION
    Comprehensive replacement of user terminology with customer terminology
#>

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$modsApiPath = Join-Path $repoRoot "serverless\mods-api"

Write-Host "Fixing user->customer references in mods-api..." -ForegroundColor Cyan
Write-Host ""

# Pattern replacements (order matters - most specific first)
$replacements = @(
    # Type names and interfaces
    @{ Pattern = '\bUserListItem\b'; Replacement = 'CustomerListItem' }
    @{ Pattern = '\bUserDetail\b'; Replacement = 'CustomerDetail' }
    @{ Pattern = '\bUserListResponse\b'; Replacement = 'CustomerListResponse' }
    @{ Pattern = '\bUpdateUserRequest\b'; Replacement = 'UpdateCustomerRequest' }
    
    # Function names
    @{ Pattern = '\blistUsers\b'; Replacement = 'listCustomers' }
    @{ Pattern = '\bgetUserDetails\b'; Replacement = 'getCustomerDetails' }
    @{ Pattern = '\bupdateUser\b'; Replacement = 'updateCustomer' }
    @{ Pattern = '\bgetUserMods\b'; Replacement = 'getCustomerMods' }
    @{ Pattern = '\bfindModsByUser\b'; Replacement = 'findModsByCustomer' }
    @{ Pattern = '\bcountModsByUser\b'; Replacement = 'findModsByCustomer' }
    
    # Variable patterns (be careful with these)
    @{ Pattern = '\buserId:\s*string'; Replacement = 'customerId: string' }
    @{ Pattern = '\buserId\?:\s*string'; Replacement = 'customerId?: string' }
    @{ Pattern = '\.userId\b'; Replacement = '.customerId' }
    @{ Pattern = '\(userId:'; Replacement = '(customerId:' }
    @{ Pattern = ',\s*userId:'; Replacement = ', customerId:' }
    @{ Pattern = '{\s*userId:'; Replacement = '{ customerId:' }
    
    # Comments and strings
    @{ Pattern = 'user ID'; Replacement = 'customer ID' }
    @{ Pattern = 'User ID'; Replacement = 'Customer ID' }
    @{ Pattern = 'user\s+management'; Replacement = 'customer management' }
    @{ Pattern = 'User\s+management'; Replacement = 'Customer management' }
)

$files = Get-ChildItem -Path $modsApiPath -Include *.ts,*.tsx -Recurse -File |
    Where-Object { $_.FullName -notmatch 'node_modules|dist|build|coverage' }

$totalFixed = 0
$filesChanged = 0

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

Write-Host ""
Write-Host "COMPLETE: Fixed $totalFixed patterns in $filesChanged files" -ForegroundColor Green
Write-Host ""
