# GitHub Wiki Migration Documentation [EMOJI]

## Overview

This document explains how to migrate all documentation from the codebase to the GitHub wiki as a one-time migration. After migration, the wiki becomes the single source of truth for documentation.

## How GitHub Wikis Work

**Important Understanding:**
- The wiki **tab** appears on your main repository page (`strixun-stream-suite`)
- But the wiki **content** is stored in a **separate git repository** that GitHub creates automatically
- The wiki repository URL is: `https://github.com/Underwood-Inc/strixun-stream-suite.wiki.git`
- This is a completely separate repository from your main code repository

Think of it like this:
- **Main repo**: `strixun-stream-suite` (your code)
- **Wiki repo**: `strixun-stream-suite.wiki` (your documentation)

They're linked in the UI, but stored separately in git.

## What Gets Migrated

The migration script finds and migrates ALL markdown files from:

- `docs/` - Main documentation directory
- `product-docs/` - Product documentation
- `serverless/` - Serverless service documentation
- `mods-hub/` - Mods hub documentation
- `shared-components/` - Shared components documentation

**Note:** `README.md` files are kept in the codebase (needed for GitHub repo display).

Files are automatically:
- Converted to wiki-friendly page names
- Fixed to have proper internal links
- Organized in the wiki structure

## One-Time Migration

### Prerequisites

1. **Get a GitHub Personal Access Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scopes: `repo` (for private repos) or `public_repo` (for public repos)
   - Copy the token

2. **Set the token as an environment variable:**
   ```bash
   # Windows PowerShell
   $env:GITHUB_TOKEN="your_token_here"
   
   # Windows CMD
   set GITHUB_TOKEN=your_token_here
   
   # Linux/Mac
   export GITHUB_TOKEN=your_token_here
   ```

### Run the Migration

```bash
pnpm run migrate-wiki
```

The script will:
1. Find ALL markdown files in documentation directories
2. Clone the wiki repository (or update if it exists)
3. Copy all documentation files to the wiki
4. Create/update the Home page
5. Commit and push changes to the wiki
6. Clean up temporary files

### After Migration

1. **Verify the wiki** - Check that all files migrated correctly
2. **List migrated files** - Run `pnpm run list-migrated-docs` to see what can be removed
3. **Remove from codebase** - Delete the migrated documentation files (keep only README.md files)
4. **Update references** - Update any code/comments that reference doc file paths

## Wiki Page Naming

Files are converted to wiki page names using this logic:

- `docs/getting-started/setup.md`  `getting-started-setup.md`
- `product-docs/ARCHITECTURAL_OVERVIEW.md`  `product-docs-architectural-overview.md`

The script preserves the directory structure as part of the filename.

## Link Fixing

The script automatically fixes relative links in markdown files:

- `[Setup](./setup.md)`  `[Setup](getting-started-setup)`
- `[API Reference](../api/reference.md)`  `[API Reference](api-reference)`

External links (http/https) are left unchanged.

## Troubleshooting

### "GITHUB_TOKEN environment variable is required"

**Solution:** Set the token as shown in the Prerequisites section above.

### "Repository not found" or "Authentication failed"

**Solution:** 
- Check that your token has the correct scopes (`repo` or `public_repo`)
- Verify the repository name is correct in `scripts/sync-wiki.ts`
- Make sure the wiki is enabled in your repository settings

### "Wiki repository doesn't exist"

**Solution:**
1. Go to your repository on GitHub
2. Click the "Wiki" tab
3. Click "Create the first page" (even if you delete it immediately)
4. This creates the wiki repository
5. Run the sync script again

### Files not appearing in wiki

**Solution:**
- Check the script output for errors
- Verify files are in `docs/` or `product-docs/` directories
- Make sure files have `.md` extension
- Check that files aren't being skipped by `SKIP_PATTERNS`

## File Organization

The wiki will have a structure like:

```
Home.md (main landing page)
docs-getting-started-setup.md
docs-getting-started-quick-start.md
docs-architecture-system-overview.md
docs-api-reference.md
product-docs-comprehensive-product-overview.md
...
```

You can organize these manually in the wiki if needed, or adjust the naming logic in the script.

## Customization

To customize what gets synced, edit `scripts/sync-wiki.ts`:

- **Add directories:** Add to `DOC_DIRS` array
- **Skip files:** Add patterns to `SKIP_PATTERNS` array
- **Change naming:** Modify `pathToWikiName()` function
- **Change link fixing:** Modify `fixWikiLinks()` function

## Best Practices

1. **Keep documentation in `docs/` directory** - This is the standard location
2. **Use relative links** - The script will fix them automatically
3. **Run sync after major doc changes** - Or let GitHub Actions handle it
4. **Review wiki after sync** - Check that links work correctly
5. **Don't edit wiki directly** - Edit source files in `docs/` instead

## See Also

- [GitHub Wiki Documentation](https://docs.github.com/en/communities/documenting-your-project-with-wikis)
- [Main Documentation Index](./README.md)

