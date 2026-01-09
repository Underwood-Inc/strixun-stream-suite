#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Fix critical auth.userId references in mods-api handlers
.DESCRIPTION
    Targeted fix for auth.userId -> auth.customerId in specific directories
#>

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

# Target specific directories we know need fixing
$targetDirs = @(
    "serverless\mods-api\handlers\mods",
    "serverless\mods-api\handlers\admin"
)

Write-Host "Fixing auth.userId references in mods-api handlers..." -ForegroundColor Cyan
Write-Host ""

$totalFixed = 0

foreach ($dir in $targetDirs) {
    $fullPath = Join-Path $repoRoot $dir
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "  Skipping $dir (not found)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "Scanning $dir..." -ForegroundColor Gray
    
    $files = Get-ChildItem -Path $fullPath -Filter "*.ts" -File
    
    foreach ($file in $files) {
        try {
            $content = [System.IO.File]::ReadAllText($file.FullName)
            
            if ($content -match 'auth\.userId') {
                $newContent = $content -replace 'auth\.userId', 'auth.customerId'
                [System.IO.File]::WriteAllText($file.FullName, $newContent)
                Write-Host "  Updated: $($file.Name)" -ForegroundColor Green
                $totalFixed++
            }
        } catch {
            Write-Host "  ERROR processing $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "COMPLETE: Fixed $totalFixed files" -ForegroundColor Green
Write-Host ""
