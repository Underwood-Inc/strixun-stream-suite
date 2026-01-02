# Documentation Consolidation Script
# Consolidates all docs/ files into PANDA_CORE and renames directories with box-drawing symbols

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$oldPandaCore = Join-Path $rootDir "__╠═══ PANDA_CORE ═══╣__"
$newPandaCore = Join-Path $rootDir "╠═══ PANDA_CORE ═══╣"
$docsDir = Join-Path $rootDir "docs"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Documentation Consolidation & Directory Renaming        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Rename main directory
Write-Host "Step 1: Renaming main PANDA_CORE directory..." -ForegroundColor Yellow
if (Test-Path $oldPandaCore) {
    if (Test-Path $newPandaCore) {
        Write-Host "  Warning: Target directory already exists. Skipping rename." -ForegroundColor Yellow
    } else {
        Rename-Item -Path $oldPandaCore -NewName "╠═══ PANDA_CORE ═══╣"
        Write-Host "  ✓ Renamed main directory" -ForegroundColor Green
    }
} else {
    Write-Host "  Warning: Old directory not found. Assuming already renamed." -ForegroundColor Yellow
}

# Update reference
$pandaCore = $newPandaCore

# Step 2: Rename subdirectories with clever box-drawing symbols
Write-Host ""
Write-Host "Step 2: Renaming subdirectories with box-drawing symbols..." -ForegroundColor Yellow

$subdirMappings = @{
    "01_GETTING_STARTED" = "╔═══ GETTING_STARTED ═══╗"
    "02_ARCHITECTURE" = "╠═══ ARCHITECTURE ═══╣"
    "03_DEVELOPMENT" = "╠═══ DEVELOPMENT ═══╣"
    "04_DEPLOYMENT" = "╠═══ DEPLOYMENT ═══╣"
    "05_SECURITY" = "╠═══ SECURITY ═══╣"
    "06_API_REFERENCE" = "╠═══ API_REFERENCE ═══╣"
    "07_SERVICES" = "╠═══ SERVICES ═══╣"
    "08_TESTING" = "╠═══ TESTING ═══╣"
    "09_AUDITS_AND_REPORTS" = "╠═══ AUDITS_AND_REPORTS ═══╣"
    "10_GUIDES_AND_TUTORIALS" = "╠═══ GUIDES_AND_TUTORIALS ═══╣"
    "11_MIGRATION_GUIDES" = "╠═══ MIGRATION_GUIDES ═══╣"
    "12_REFERENCE" = "╚═══ REFERENCE ═══╝"
}

foreach ($oldName in $subdirMappings.Keys) {
    $oldPath = Join-Path $pandaCore $oldName
    $newName = $subdirMappings[$oldName]
    $newPath = Join-Path $pandaCore $newName
    
    if (Test-Path $oldPath) {
        if (Test-Path $newPath) {
            Write-Host "  Warning: $newName already exists. Skipping." -ForegroundColor Yellow
        } else {
            Rename-Item -Path $oldPath -NewName $newName
            Write-Host "  ✓ Renamed $oldName -> $newName" -ForegroundColor Green
        }
    }
}

# Update subdirectory references
$subdirMap = @{}
foreach ($oldName in $subdirMappings.Keys) {
    $subdirMap[$oldName] = $subdirMappings[$oldName]
}

# Step 3: File mapping function
function Map-FileToCategory {
    param(
        [string]$filePath,
        [hashtable]$subdirMap
    )
    
    $fileName = Split-Path -Leaf $filePath
    $relativePath = $filePath.Replace($docsDir + "\", "").Replace($docsDir + "/", "")
    $dirName = Split-Path -Parent $relativePath
    
    # Root level files in docs/
    if ($dirName -eq "." -or $dirName -eq "") {
        switch -Wildcard ($fileName) {
            "*GETTING_STARTED*" { return $subdirMap["01_GETTING_STARTED"] }
            "*ARCHITECTURE*" { return $subdirMap["02_ARCHITECTURE"] }
            "*DEVELOPMENT*" { return $subdirMap["03_DEVELOPMENT"] }
            "*DEPLOYMENT*" { return $subdirMap["04_DEPLOYMENT"] }
            "*SECURITY*" { return $subdirMap["05_SECURITY"] }
            "*API*" { return $subdirMap["06_API_REFERENCE"] }
            "*SERVICE*" { return $subdirMap["07_SERVICES"] }
            "*TEST*" { return $subdirMap["08_TESTING"] }
            "*AUDIT*" { return $subdirMap["09_AUDITS_AND_REPORTS"] }
            "*GUIDE*" { return $subdirMap["10_GUIDES_AND_TUTORIALS"] }
            "*MIGRATION*" { return $subdirMap["11_MIGRATION_GUIDES"] }
            "*REFERENCE*" { return $subdirMap["12_REFERENCE"] }
            "*BUILD*" { return $subdirMap["03_DEVELOPMENT"] }
            "*CACHE*" { return $subdirMap["09_AUDITS_AND_REPORTS"] }
            "*CHAT*" { return $subdirMap["02_ARCHITECTURE"] }
            "*PRODUCT*" { return $subdirMap["12_REFERENCE"] }
            "*STORYBOOK*" { return $subdirMap["03_DEVELOPMENT"] }
            "*WIKI*" { return $subdirMap["03_DEVELOPMENT"] }
            "*RESEND*" { return $subdirMap["10_GUIDES_AND_TUTORIALS"] }
            "*SCROLLBAR*" { return $subdirMap["12_REFERENCE"] }
            "*ANALYTICS*" { return $subdirMap["12_REFERENCE"] }
            "*CLOUDFLARE*" { return $subdirMap["12_REFERENCE"] }
            "*DEAD_CODE*" { return $subdirMap["09_AUDITS_AND_REPORTS"] }
            "*AUTO_CONFIG*" { return $subdirMap["10_GUIDES_AND_TUTORIALS"] }
            default { return $subdirMap["12_REFERENCE"] }
        }
    }
    
    # Subdirectory-based mapping
    switch ($dirName.ToLower()) {
        "getting-started" { return $subdirMap["01_GETTING_STARTED"] }
        "architecture" { return $subdirMap["02_ARCHITECTURE"] }
        "development" { return $subdirMap["03_DEVELOPMENT"] }
        "deployment" { return $subdirMap["04_DEPLOYMENT"] }
        "security" { return $subdirMap["05_SECURITY"] }
        "api" { return $subdirMap["06_API_REFERENCE"] }
        "services" { 
            # Service-specific files go to 07_SERVICES
            return $subdirMap["07_SERVICES"]
        }
        "guides" { return $subdirMap["10_GUIDES_AND_TUTORIALS"] }
        "reference" { return $subdirMap["12_REFERENCE"] }
        default { return $subdirMap["12_REFERENCE"] }
    }
}

# Step 4: Consolidate all files from docs/
Write-Host ""
Write-Host "Step 3: Consolidating files from docs/ directory..." -ForegroundColor Yellow

if (-not (Test-Path $docsDir)) {
    Write-Host "  Warning: docs/ directory not found. Skipping consolidation." -ForegroundColor Yellow
} else {
    $allFiles = Get-ChildItem -Path $docsDir -Recurse -File -Filter "*.md"
    $movedCount = 0
    $skippedCount = 0
    $errorCount = 0
    
    foreach ($file in $allFiles) {
        try {
            $targetCategory = Map-FileToCategory -filePath $file.FullName -subdirMap $subdirMap
            $targetDir = Join-Path $pandaCore $targetCategory
            
            if (-not (Test-Path $targetDir)) {
                New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
            }
            
            $targetPath = Join-Path $targetDir $file.Name
            
            # Handle name conflicts
            if (Test-Path $targetPath) {
                $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                $extension = [System.IO.Path]::GetExtension($file.Name)
                $counter = 1
                do {
                    $newName = "${baseName}_${counter}${extension}"
                    $targetPath = Join-Path $targetDir $newName
                    $counter++
                } while (Test-Path $targetPath)
            }
            
            Move-Item -Path $file.FullName -Destination $targetPath -Force
            $movedCount++
            Write-Host "  ✓ Moved: $($file.Name) -> $targetCategory" -ForegroundColor Green
        }
        catch {
            $errorCount++
            Write-Host "  ✗ Error moving $($file.Name): $_" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "  Summary: $movedCount moved, $skippedCount skipped, $errorCount errors" -ForegroundColor Cyan
}

# Step 5: Clean up empty directories in docs/
Write-Host ""
Write-Host "Step 4: Cleaning up empty directories in docs/..." -ForegroundColor Yellow

if (Test-Path $docsDir) {
    $emptyDirs = Get-ChildItem -Path $docsDir -Recurse -Directory | Where-Object {
        (Get-ChildItem -Path $_.FullName -Recurse -File).Count -eq 0
    } | Sort-Object -Property FullName -Descending
    
    foreach ($dir in $emptyDirs) {
        try {
            Remove-Item -Path $dir.FullName -Force
            Write-Host "  ✓ Removed empty directory: $($dir.Name)" -ForegroundColor Green
        }
        catch {
            Write-Host "  ✗ Error removing $($dir.Name): $_" -ForegroundColor Red
        }
    }
}

# Step 6: Remove docs/ if empty
Write-Host ""
Write-Host "Step 5: Checking if docs/ directory can be removed..." -ForegroundColor Yellow

if (Test-Path $docsDir) {
    $remainingFiles = Get-ChildItem -Path $docsDir -Recurse -File
    if ($remainingFiles.Count -eq 0) {
        try {
            Remove-Item -Path $docsDir -Force -Recurse
            Write-Host "  ✓ Removed empty docs/ directory" -ForegroundColor Green
        }
        catch {
            Write-Host "  ✗ Error removing docs/ directory: $_" -ForegroundColor Red
            Write-Host "  Note: Some files may still remain. Please check manually." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  Note: docs/ directory still contains $($remainingFiles.Count) files" -ForegroundColor Yellow
        Write-Host "  These files were not moved. Please review manually." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Consolidation Complete!                                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
