#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Documentation Consolidation Script
Consolidates all docs/ files into PANDA_CORE and renames directories with box-drawing symbols
"""

import os
import shutil
import sys
from pathlib import Path

# Set UTF-8 encoding for stdout
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Box-drawing characters for subdirectories
SUBDIR_MAPPINGS = {
    "01_GETTING_STARTED": "╔═══ GETTING_STARTED ═══╗",
    "02_ARCHITECTURE": "╠═══ ARCHITECTURE ═══╣",
    "03_DEVELOPMENT": "╠═══ DEVELOPMENT ═══╣",
    "04_DEPLOYMENT": "╠═══ DEPLOYMENT ═══╣",
    "05_SECURITY": "╠═══ SECURITY ═══╣",
    "06_API_REFERENCE": "╠═══ API_REFERENCE ═══╣",
    "07_SERVICES": "╠═══ SERVICES ═══╣",
    "08_TESTING": "╠═══ TESTING ═══╣",
    "09_AUDITS_AND_REPORTS": "╠═══ AUDITS_AND_REPORTS ═══╣",
    "10_GUIDES_AND_TUTORIALS": "╠═══ GUIDES_AND_TUTORIALS ═══╣",
    "11_MIGRATION_GUIDES": "╠═══ MIGRATION_GUIDES ═══╣",
    "12_REFERENCE": "╚═══ REFERENCE ═══╝",
}

def map_file_to_category(file_path: Path, docs_dir: Path) -> str:
    """Map a file to its target category directory name."""
    relative_path = file_path.relative_to(docs_dir)
    dir_name = relative_path.parent.name.lower()
    file_name = relative_path.name.lower()
    
    # Root level files in docs/
    if dir_name == "." or dir_name == "":
        if "getting_started" in file_name or "setup" in file_name or "environment" in file_name:
            return SUBDIR_MAPPINGS["01_GETTING_STARTED"]
        elif "architecture" in file_name:
            return SUBDIR_MAPPINGS["02_ARCHITECTURE"]
        elif "development" in file_name or "build" in file_name or "storybook" in file_name or "wiki" in file_name:
            return SUBDIR_MAPPINGS["03_DEVELOPMENT"]
        elif "deployment" in file_name:
            return SUBDIR_MAPPINGS["04_DEPLOYMENT"]
        elif "security" in file_name:
            return SUBDIR_MAPPINGS["05_SECURITY"]
        elif "api" in file_name:
            return SUBDIR_MAPPINGS["06_API_REFERENCE"]
        elif "service" in file_name:
            return SUBDIR_MAPPINGS["07_SERVICES"]
        elif "test" in file_name:
            return SUBDIR_MAPPINGS["08_TESTING"]
        elif "audit" in file_name or "cache" in file_name or "dead_code" in file_name:
            return SUBDIR_MAPPINGS["09_AUDITS_AND_REPORTS"]
        elif "guide" in file_name or "resend" in file_name or "auto_config" in file_name:
            return SUBDIR_MAPPINGS["10_GUIDES_AND_TUTORIALS"]
        elif "migration" in file_name:
            return SUBDIR_MAPPINGS["11_MIGRATION_GUIDES"]
        elif "product" in file_name or "reference" in file_name or "scrollbar" in file_name or "analytics" in file_name or "cloudflare" in file_name or "chat" in file_name:
            return SUBDIR_MAPPINGS["12_REFERENCE"]
        else:
            return SUBDIR_MAPPINGS["12_REFERENCE"]
    
    # Subdirectory-based mapping
    if dir_name == "getting-started":
        return SUBDIR_MAPPINGS["01_GETTING_STARTED"]
    elif dir_name == "architecture":
        return SUBDIR_MAPPINGS["02_ARCHITECTURE"]
    elif dir_name == "development":
        return SUBDIR_MAPPINGS["03_DEVELOPMENT"]
    elif dir_name == "deployment":
        return SUBDIR_MAPPINGS["04_DEPLOYMENT"]
    elif dir_name == "security":
        return SUBDIR_MAPPINGS["05_SECURITY"]
    elif dir_name == "api":
        return SUBDIR_MAPPINGS["06_API_REFERENCE"]
    elif dir_name == "services":
        return SUBDIR_MAPPINGS["07_SERVICES"]
    elif dir_name == "guides":
        return SUBDIR_MAPPINGS["10_GUIDES_AND_TUTORIALS"]
    elif dir_name == "reference":
        return SUBDIR_MAPPINGS["12_REFERENCE"]
    else:
        return SUBDIR_MAPPINGS["12_REFERENCE"]

def main():
    root_dir = Path(__file__).parent.parent
    old_panda_core = root_dir / "╠═══ PANDA_CORE ═══╣"
    new_panda_core = root_dir / "╠═══ PANDA_CORE ═══╣"
    docs_dir = root_dir / "docs"
    
    print("╔════════════════════════════════════════════════════════════╗")
    print("║  Documentation Consolidation & Directory Renaming        ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print()
    
    # Step 1: Rename main directory
    print("Step 1: Renaming main PANDA_CORE directory...")
    if old_panda_core.exists():
        if new_panda_core.exists():
            print("  Warning: Target directory already exists. Using existing directory.")
            panda_core = new_panda_core
        else:
            try:
                old_panda_core.rename(new_panda_core)
                print("  ✓ Renamed main directory")
                panda_core = new_panda_core
            except Exception as e:
                print(f"  ✗ Error renaming directory: {e}")
                print("  Continuing with existing directory name...")
                panda_core = old_panda_core
    else:
        if new_panda_core.exists():
            print("  Main directory already renamed.")
            panda_core = new_panda_core
        else:
            print("  ✗ PANDA_CORE directory not found!")
            return
    
    # Step 2: Rename subdirectories
    print()
    print("Step 2: Renaming subdirectories with box-drawing symbols...")
    for old_name, new_name in SUBDIR_MAPPINGS.items():
        old_path = panda_core / old_name
        new_path = panda_core / new_name
        
        if old_path.exists():
            if new_path.exists():
                print(f"  Warning: {new_name} already exists. Skipping.")
            else:
                try:
                    old_path.rename(new_path)
                    print(f"  ✓ Renamed {old_name} -> {new_name}")
                except Exception as e:
                    print(f"  ✗ Error renaming {old_name}: {e}")
        else:
            if new_path.exists():
                print(f"  {new_name} already exists.")
    
    # Step 3: Consolidate files from docs/
    print()
    print("Step 3: Consolidating files from docs/ directory...")
    
    if not docs_dir.exists():
        print("  Warning: docs/ directory not found. Skipping consolidation.")
    else:
        moved_count = 0
        error_count = 0
        
        # Get all markdown files
        all_files = list(docs_dir.rglob("*.md"))
        
        for file_path in all_files:
            try:
                target_category = map_file_to_category(file_path, docs_dir)
                target_dir = panda_core / target_category
                
                # Create target directory if it doesn't exist
                target_dir.mkdir(parents=True, exist_ok=True)
                
                # Determine target file path
                target_file = target_dir / file_path.name
                
                # Handle name conflicts
                counter = 1
                while target_file.exists():
                    stem = file_path.stem
                    suffix = file_path.suffix
                    target_file = target_dir / f"{stem}_{counter}{suffix}"
                    counter += 1
                
                # Move file
                shutil.move(str(file_path), str(target_file))
                moved_count += 1
                print(f"  ✓ Moved: {file_path.name} -> {target_category}")
            except Exception as e:
                error_count += 1
                print(f"  ✗ Error moving {file_path.name}: {e}")
        
        print()
        print(f"  Summary: {moved_count} moved, {error_count} errors")
    
    # Step 4: Clean up empty directories in docs/
    print()
    print("Step 4: Cleaning up empty directories in docs/...")
    
    if docs_dir.exists():
        # Get all directories, sorted by depth (deepest first)
        all_dirs = sorted(docs_dir.rglob("*"), key=lambda p: len(str(p)), reverse=True)
        removed_count = 0
        
        for dir_path in all_dirs:
            if dir_path.is_dir():
                try:
                    # Check if directory is empty
                    if not any(dir_path.iterdir()):
                        dir_path.rmdir()
                        removed_count += 1
                        print(f"  ✓ Removed empty directory: {dir_path.name}")
                except Exception as e:
                    print(f"  ✗ Error removing {dir_path.name}: {e}")
        
        print(f"  Removed {removed_count} empty directories")
    
    # Step 5: Remove docs/ if empty
    print()
    print("Step 5: Checking if docs/ directory can be removed...")
    
    if docs_dir.exists():
        remaining_files = list(docs_dir.rglob("*"))
        if not remaining_files:
            try:
                docs_dir.rmdir()
                print("  ✓ Removed empty docs/ directory")
            except Exception as e:
                print(f"  ✗ Error removing docs/ directory: {e}")
                print("  Note: Some files may still remain. Please check manually.")
        else:
            print(f"  Note: docs/ directory still contains {len(remaining_files)} items")
            print("  These items were not moved. Please review manually.")
    
    print()
    print("╔════════════════════════════════════════════════════════════╗")
    print("║  Consolidation Complete!                                   ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print()

if __name__ == "__main__":
    main()
