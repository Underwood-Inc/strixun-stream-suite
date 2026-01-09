#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Fix all user→customer references in mods-hub frontend
.DESCRIPTION
    Comprehensive replacement of user terminology with customer terminology
#>

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$modsHubPath = Join-Path $repoRoot "mods-hub"

Write-Host "Fixing user->customer references in mods-hub..." -ForegroundColor Cyan
Write-Host ""

# Pattern replacements (order matters - most specific first)
$replacements = @(
    # Type names and interfaces
    @{ Pattern = '\bUserListItem\b'; Replacement = 'CustomerListItem' }
    @{ Pattern = '\bUserDetail\b'; Replacement = 'CustomerDetail' }
    @{ Pattern = '\bUserListResponse\b'; Replacement = 'CustomerListResponse' }
    @{ Pattern = '\bUpdateUserRequest\b'; Replacement = 'UpdateCustomerRequest' }
    @{ Pattern = '\bUserManagementPage\b'; Replacement = 'CustomerManagementPage' }
    
    # Hook names
    @{ Pattern = '\buseUsersList\b'; Replacement = 'useCustomersList' }
    @{ Pattern = '\buseUserDetails\b'; Replacement = 'useCustomerDetails' }
    @{ Pattern = '\buseUpdateUser\b'; Replacement = 'useUpdateCustomer' }
    @{ Pattern = '\buseUserMods\b'; Replacement = 'useCustomerMods' }
    
    # Query key names
    @{ Pattern = '\buserKeys\b'; Replacement = 'customerKeys' }
    
    # Function names
    @{ Pattern = '\blistUsers\b'; Replacement = 'listCustomers' }
    @{ Pattern = '\bgetUserDetails\b'; Replacement = 'getCustomerDetails' }
    @{ Pattern = '\bupdateUser\b'; Replacement = 'updateCustomer' }
    @{ Pattern = '\bgetUserMods\b'; Replacement = 'getCustomerMods' }
    @{ Pattern = '\bfilterUsersBySearchQuery\b'; Replacement = 'filterCustomersBySearchQuery' }
    
    # Variable patterns
    @{ Pattern = '\buserId:\s*string'; Replacement = 'customerId: string' }
    @{ Pattern = '\buserId\?:\s*string'; Replacement = 'customerId?: string' }
    @{ Pattern = '\.userId\b'; Replacement = '.customerId' }
    @{ Pattern = '\(userId:'; Replacement = '(customerId:' }
    @{ Pattern = ',\s*userId:'; Replacement = ', customerId:' }
    @{ Pattern = '{\s*userId\b'; Replacement = '{ customerId' }
    @{ Pattern = '\bconst userId\b'; Replacement = 'const customerId' }
    @{ Pattern = '\blet userId\b'; Replacement = 'let customerId' }
    
    # URL paths
    @{ Pattern = '/admin/users'; Replacement = '/admin/customers' }
    @{ Pattern = '/users/'; Replacement = '/customers/' }
    
    # Property names in objects
    @{ Pattern = '\busers:\s'; Replacement = 'customers: ' }
    @{ Pattern = '"users"'; Replacement = '"customers"' }
    @{ Pattern = "'users'"; Replacement = "'customers'" }
    
    # UI text
    @{ Pattern = 'Total Users'; Replacement = 'Total Customers' }
    @{ Pattern = 'User Management'; Replacement = 'Customer Management' }
    @{ Pattern = 'user management'; Replacement = 'customer management' }
    @{ Pattern = 'User ID'; Replacement = 'Customer ID' }
    @{ Pattern = 'user ID'; Replacement = 'customer ID' }
)

$files = Get-ChildItem -Path $modsHubPath -Include *.ts,*.tsx,*.js,*.jsx -Recurse -File |
    Where-Object { $_.FullName -notmatch 'node_modules|dist|build|coverage|\.next' }

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
