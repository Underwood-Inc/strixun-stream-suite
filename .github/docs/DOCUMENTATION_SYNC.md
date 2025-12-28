# 📚 Documentation Sync System

> **How our documentation stays in sync automatically - no manual work required!**

This document explains how our automated documentation synchronization system works, keeping the GitHub wiki up-to-date with the codebase documentation.

---

## 🎯 Overview

Our documentation sync system automatically:
1. **Monitors** markdown files in the codebase
2. **Detects** changes to documentation
3. **Syncs** documentation to the GitHub wiki
4. **Maintains** a single source of truth (the codebase)

**The result?** Documentation in the wiki is always current, and you never have to manually update it! 🎉

---

## 🔄 How It Works

### The Sync Process

```
┌─────────────────────────────────────────────────────────┐
│              Documentation Sync Flow                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. Developer commits markdown changes to main/master     │
│                                                           │
│  2. GitHub Actions workflow triggers automatically       │
│     (sync-wiki.yml)                                       │
│                                                           │
│  3. Workflow detects which .md files changed              │
│                                                           │
│  4. Migration script (migrate-wiki.ts) runs:              │
│     • Reads documentation from codebase                   │
│     • Formats and organizes for wiki                     │
│     • Pushes to wiki repository                          │
│                                                           │
│  5. Wiki is automatically updated! ✨                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### What Gets Synced?

The workflow monitors these directories:
- `docs/**/*.md` - General documentation
- `product-docs/**/*.md` - Product documentation
- `serverless/**/*.md` - Serverless service docs
- `mods-hub/**/*.md` - Mods hub documentation
- `shared-components/**/*.md` - Shared component docs
- `README.md` - Root README (becomes wiki Home page)

### When Does It Sync?

**Automatic triggers:**
- ✅ Push to `main` or `master` branch
- ✅ Any markdown file changes in monitored directories
- ✅ Changes to the migration script itself

**Manual triggers:**
- ✅ Workflow dispatch (run manually from Actions tab)
- ✅ Useful for initial setup or bulk updates

---

## 🛠️ Technical Details

### Workflow File

**Location:** `.github/workflows/sync-wiki.yml`

**Key features:**
- Uses built-in `GITHUB_TOKEN` (no custom secrets needed!)
- Automatic wiki write permissions
- Concurrency control (only one sync at a time)
- Smart change detection (only syncs when needed)

### Migration Script

**Location:** `scripts/migrate-wiki.ts`

**What it does:**
1. Clones the wiki repository (GitHub creates this automatically)
2. Reads markdown files from codebase
3. Transforms and organizes for wiki structure
4. Commits and pushes changes to wiki

**Permissions:**
- Uses `GITHUB_TOKEN` which has automatic wiki access
- No additional configuration needed!

---

## 🔒 Wiki Protection Setup

### Why Protect the Wiki?

We want the wiki to be **read-only via the UI** so that:
- ✅ All documentation changes go through code review
- ✅ Documentation is version-controlled in the main repo
- ✅ No accidental edits that get overwritten
- ✅ Consistent formatting and structure

### How to Protect the Wiki

#### Option 1: Disable Wiki Editing (Recommended)

**Steps:**
1. Go to your repository on GitHub
2. Click **Settings** → **Features**
3. Under **Wikis**, you'll see:
   - ✅ **Allow wiki editing** (uncheck this)
   - ✅ **Restrict editing to collaborators only** (check this)

**Result:** Wiki becomes read-only via the UI, but workflows can still update it!

**Note:** This setting prevents manual edits but **doesn't prevent workflow updates**. The `GITHUB_TOKEN` in workflows has special permissions that bypass this restriction.

#### Option 2: Branch Protection (If Wiki is Git Repo)

If you want even more control, you can treat the wiki as a git repository:

1. **Clone the wiki repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.wiki.git
   ```

2. **Set up branch protection:**
   - Go to repository **Settings** → **Branches**
   - Add a branch protection rule for `main` branch in the wiki repo
   - Require pull requests for changes
   - Restrict who can push

3. **Update workflow to use pull requests:**
   - Modify `sync-wiki.yml` to create PRs instead of direct pushes
   - Requires additional workflow configuration

**Note:** This is more complex and usually unnecessary. Option 1 is simpler and sufficient.

#### Option 3: Repository Settings (Additional Protection)

**Repository Settings → General → Features:**
- ✅ **Wikis**: Enabled
- ✅ **Restrict editing to collaborators only**: Enabled

**Repository Settings → Actions → General → Workflow permissions:**
- ✅ **Read and write permissions**: Enabled (required for wiki sync)

---

## 📋 Setup Checklist

### Initial Setup

- [ ] **Enable Wikis** in repository settings
  - Go to Settings → Features → Wikis
  - Check "Wikis" to enable
  - Check "Restrict editing to collaborators only"
  
- [ ] **Configure Workflow Permissions**
  - Go to Settings → Actions → General → Workflow permissions
  - Select "Read and write permissions"
  - This allows `GITHUB_TOKEN` to push to wiki

- [ ] **Verify Workflow File**
  - Ensure `.github/workflows/sync-wiki.yml` exists
  - Check that monitored paths match your documentation structure

- [ ] **Test the Sync**
  - Make a small change to a markdown file
  - Push to main/master branch
  - Check Actions tab for workflow run
  - Verify wiki was updated

### Ongoing Maintenance

- [ ] **Documentation changes** automatically sync (no action needed!)
- [ ] **Workflow failures** are logged in Actions tab
- [ ] **Manual sync** available via workflow_dispatch

---

## 🚨 Troubleshooting

### "Wiki sync failed - repository not found"

**Cause:** Wiki hasn't been created yet.

**Fix:**
1. Go to repository Settings → Features → Wikis
2. Enable wikis and save
3. This creates the wiki repository automatically
4. Re-run the workflow

### "GITHUB_TOKEN not set"

**Cause:** Workflow permissions not configured.

**Fix:**
1. Go to Settings → Actions → General → Workflow permissions
2. Select "Read and write permissions"
3. The built-in `GITHUB_TOKEN` will then have wiki access
4. Re-run the workflow

### "Permission denied" errors

**Cause:** Wiki editing restrictions too strict.

**Fix:**
1. Go to Settings → Features → Wikis
2. Ensure "Restrict editing to collaborators only" is checked (not disabled)
3. Workflows can still update even with this restriction
4. Re-run the workflow

### Wiki not updating

**Check:**
1. ✅ Workflow ran successfully? (Check Actions tab)
2. ✅ Markdown files in monitored directories?
3. ✅ Changes pushed to main/master branch?
4. ✅ Wiki enabled in repository settings?

---

## 🔍 Monitoring

### Check Sync Status

**GitHub Actions:**
- Go to **Actions** tab
- Look for "Sync Documentation to Wiki" workflow
- Green checkmark = success ✅
- Red X = failure ❌

### View Sync History

**Workflow runs show:**
- When sync was triggered
- Which files were synced
- Commit hash that triggered sync
- Who triggered it (actor)

### Manual Sync

**To manually trigger a sync:**
1. Go to **Actions** tab
2. Select "Sync Documentation to Wiki" workflow
3. Click "Run workflow"
4. Select branch (usually `main` or `master`)
5. Click "Run workflow" button

---

## 📝 Template Synchronization

### README Template Location

The README template exists in two places:
1. **Source:** `__╠═══ PANDA_CORE ═══╣__/README_TEMPLATE.md`
2. **Reference:** `.github/docs/README_TEMPLATE.md`

### Keeping Templates in Sync

**Current approach:** Manual copy (symlinks require admin privileges on Windows)

**To sync templates:**
```bash
# Copy from source to .github/docs
cp "__╠═══ PANDA_CORE ═══╣__/README_TEMPLATE.md" ".github/docs/README_TEMPLATE.md"
cp "__╠═══ PANDA_CORE ═══╣__/TEMPLATE_GUIDE.md" ".github/docs/TEMPLATE_GUIDE.md"
```

**Future enhancement:** Could add a pre-commit hook or script to auto-sync templates.

---

## 🎯 Best Practices

### Documentation Structure

- ✅ **Keep docs in codebase** - Single source of truth
- ✅ **Use consistent formatting** - Follow the README template
- ✅ **Organize by directory** - Matches wiki structure
- ✅ **Version control everything** - All changes go through PRs

### Wiki Organization

- ✅ **Home page** = Root README.md
- ✅ **Directory structure** = Mirrors codebase structure
- ✅ **Automatic organization** - Migration script handles this

### Workflow Management

- ✅ **Monitor workflow runs** - Check Actions tab regularly
- ✅ **Fix failures promptly** - Wiki can get out of sync
- ✅ **Test changes locally** - Before pushing to main

---

## 🔮 Future Enhancements

- **Auto-sync templates**: Script to keep template copies in sync
- **Preview changes**: Show wiki diff before syncing
- **Selective sync**: Only sync changed files (performance)
- **Wiki structure customization**: Config file for custom organization
- **Multi-wiki support**: Sync to multiple wiki repositories

---

## 📚 Related Documentation

- **README Template**: `.github/docs/README_TEMPLATE.md`
- **Template Guide**: `.github/docs/TEMPLATE_GUIDE.md`
- **Source Template**: `__╠═══ PANDA_CORE ═══╣__/README_TEMPLATE.md`
- **Workflow File**: `.github/workflows/sync-wiki.yml`
- **Migration Script**: `scripts/migrate-wiki.ts`

---

## 🙋 Questions?

**Common questions:**
- **Q:** Can I still edit the wiki manually?
  - **A:** Not recommended - changes will be overwritten on next sync. Edit docs in codebase instead.

- **Q:** How often does it sync?
  - **A:** Every time markdown files change on main/master branch.

- **Q:** What if the sync fails?
  - **A:** Check the Actions tab for error details. Common fixes are in the Troubleshooting section above.

- **Q:** Can I disable automatic syncing?
  - **A:** Yes, but not recommended. You can disable the workflow in repository settings.

---

**Remember:** The codebase is the source of truth. Edit documentation there, and the wiki will automatically stay in sync! 🚀

