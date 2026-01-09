# 🔒 GitHub Wiki Protection Guide

> **How to make your GitHub wiki read-only via UI while allowing automated updates**

This guide explains how to protect your GitHub wiki so that it can only be updated through automated workflows, preventing manual edits that would be overwritten.

---

## 🎯 Why Protect the Wiki?

### The Problem
- Manual wiki edits get overwritten by automated sync
- Documentation changes should go through code review
- Need version control for all documentation changes
- Want single source of truth (codebase, not wiki)

### The Solution
- Make wiki read-only via UI
- Allow automated workflow updates
- All changes go through PRs in main repository

---

## 🛡️ Protection Methods

### Method 1: Repository Settings (Recommended) ⭐

**This is the simplest and most effective method.**

#### Steps:

1. **Go to Repository Settings**
   - Navigate to your repository on GitHub
   - Click **Settings** (top right, gear icon)

2. **Configure Wiki Settings**
   - In the left sidebar, click **Features**
   - Scroll to the **Wikis** section
   - Configure as follows:
     ```
     ✓ Wikis: Enabled
     ✓ Restrict editing to collaborators only: Enabled
     ```

3. **Configure Workflow Permissions**
   - In Settings, click **Actions** → **General**
   - Scroll to **Workflow permissions**
   - Select:
     ```
     ✓ Read and write permissions
     ```
   - This allows `GITHUB_TOKEN` to push to wiki even with restrictions

4. **Verify Protection**
   - Try editing a wiki page manually
   - You should see: "You don't have permission to edit this wiki"
   - ✓ This means protection is working!

#### How It Works:

- **Manual edits:** Blocked by "Restrict editing to collaborators only"
- **Workflow updates:** Allowed because `GITHUB_TOKEN` has special permissions
- **Result:** Wiki is effectively read-only via UI, but workflows can update it

#### Important Notes:

- ⚠ **Repository admins** can still edit manually (by design)
- ⚠ **Collaborators** cannot edit (this is what we want)
- ✓ **Workflows** can always update (this is what we need)

---

### Method 2: Disable Wiki Editing Completely

**Use this if you want maximum protection (even admins can't edit).**

#### Steps:

1. **Go to Repository Settings** → **Features**

2. **Disable Wiki Editing**
   - Uncheck "Allow wiki editing"
   - This completely disables the wiki edit UI

3. **Keep Wikis Enabled**
   - Keep "Wikis" checked (enabled)
   - This allows the wiki to exist and be viewable

#### Result:

- ✓ Wiki is completely read-only via UI
- ✓ Workflows can still update (via git push)
- ✓ Even repository admins can't edit via UI

#### Trade-offs:

- ✗ Admins can't make quick fixes via UI
- ✓ Maximum protection against accidental edits
- ✓ Forces all changes through code review

---

### Method 3: Branch Protection (Advanced)

**For maximum control, treat wiki as a separate repository with branch protection.**

#### Prerequisites:

- Wiki repository exists (created automatically when you enable wikis)
- You have admin access to the repository

#### Steps:

1. **Clone the Wiki Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.wiki.git
   cd YOUR_REPO.wiki
   ```

2. **Set Up Branch Protection**
   - Go to your **main repository** Settings
   - Click **Branches** (left sidebar)
   - **Note:** Wiki repo is separate, so you'd need to:
     - Create a separate repository for wiki
     - Set up branch protection there
     - Update workflow to use that repo

3. **Update Workflow to Use Pull Requests**
   - Modify `.github/workflows/sync-wiki.yml`
   - Instead of direct push, create a pull request
   - Requires additional workflow steps

#### Complexity:

- ⚠ More complex setup
- ⚠ Requires managing two repositories
- ⚠ Usually unnecessary for most use cases

**Recommendation:** Use Method 1 or 2 instead - they're simpler and sufficient.

---

## 🔍 Verification Steps

### Test 1: Manual Edit Attempt

1. Go to your wiki: `https://github.com/YOUR_USERNAME/YOUR_REPO/wiki`
2. Click "Edit" on any page
3. **Expected result:**
   - ✗ "You don't have permission to edit this wiki"
   - ✓ Protection is working!

### Test 2: Workflow Update

1. Make a change to a markdown file in the codebase
2. Push to main/master branch
3. Check Actions tab - workflow should run
4. Check wiki - should be updated automatically
5. **Expected result:**
   - ✓ Wiki updates successfully
   - ✓ Workflow has write access

### Test 3: Admin Edit (If Using Method 1)

1. As repository admin, try to edit wiki
2. **Expected result (Method 1):**
   - ✓ Admin can still edit (by design)
   - ⚠ But changes will be overwritten on next sync

3. **Expected result (Method 2):**
   - ✗ Even admin can't edit (maximum protection)

---

## 📋 Recommended Configuration

### For Most Projects (Recommended)

**Repository Settings → Features:**
```
✓ Wikis: Enabled
✓ Restrict editing to collaborators only: Enabled
```

**Repository Settings → Actions → General:**
```
✓ Read and write permissions
```

**Result:**
- ✓ Collaborators can't edit (protected)
- ✓ Workflows can update (automated)
- ✓ Admins can edit (for emergencies, but discouraged)

### For Maximum Protection

**Repository Settings → Features:**
```
✓ Wikis: Enabled
✗ Allow wiki editing: Disabled
```

**Repository Settings → Actions → General:**
```
✓ Read and write permissions
```

**Result:**
- ✓ No one can edit via UI (maximum protection)
- ✓ Workflows can update (automated)
- ✓ All changes must go through code review

---

## 🚨 Troubleshooting

### "Workflow can't push to wiki"

**Symptoms:**
- Workflow runs but fails with permission error
- Wiki doesn't update

**Fix:**
1. Go to Settings → Actions → General → Workflow permissions
2. Ensure "Read and write permissions" is selected
3. The `GITHUB_TOKEN` needs write access
4. Re-run the workflow

### "Wiki editing still works"

**Symptoms:**
- You can still edit wiki manually
- Protection not working

**Fix:**
1. Check Settings → Features → Wikis
2. Ensure "Restrict editing to collaborators only" is checked
3. If you're a collaborator, you shouldn't be able to edit
4. If you're an admin, this is expected (Method 1)

### "Workflow has permission but still fails"

**Symptoms:**
- Permissions are correct
- Workflow still fails

**Possible causes:**
1. Wiki repository doesn't exist yet
   - **Fix:** Enable wikis in Settings → Features
2. Wiki was disabled and re-enabled
   - **Fix:** Re-run the workflow after enabling
3. Token expiration (shouldn't happen with GITHUB_TOKEN)
   - **Fix:** Re-run the workflow

---

## 🔐 Security Considerations

### What's Protected?

- ✓ **Manual edits** via UI are blocked (or restricted)
- ✓ **Documentation changes** go through code review
- ✓ **Version control** for all changes
- ✓ **Audit trail** in main repository

### What's Not Protected?

- ⚠ **Repository admins** can still edit (Method 1)
- ⚠ **Workflow token** has write access (by design)
- ⚠ **Wiki git repository** is still accessible via git

### Best Practices

1. **Use Method 2** for maximum protection
2. **Monitor workflow runs** - check Actions tab regularly
3. **Review documentation PRs** - ensure quality
4. **Document the process** - so team knows how it works
5. **Test protection** - verify it's working after setup

---

## 📝 Workflow Configuration

### Current Setup

Our workflow (`.github/workflows/sync-wiki.yml`) uses:

```yaml
permissions:
  contents: read
  # Wiki write permissions are automatically granted to GITHUB_TOKEN
```

**Key points:**
- `GITHUB_TOKEN` has automatic wiki write access
- No custom tokens needed
- Works even with wiki editing restrictions

### How It Works

1. **Workflow runs** with `GITHUB_TOKEN`
2. **Token has special permissions** for wiki access
3. **Bypasses UI restrictions** (can push via git)
4. **Updates wiki** automatically

**This is by design** - GitHub allows workflows to update wikis even when UI editing is restricted.

---

## 🎯 Quick Setup Checklist

### Initial Setup

- [ ] Enable Wikis in repository settings
- [ ] Configure wiki editing restrictions (Method 1 or 2)
- [ ] Set workflow permissions to "Read and write"
- [ ] Test manual edit (should be blocked)
- [ ] Test workflow update (should work)
- [ ] Document the setup for your team

### Ongoing

- [ ] Monitor workflow runs (check Actions tab)
- [ ] Fix any workflow failures promptly
- [ ] Remind team: edit docs in codebase, not wiki
- [ ] Review documentation PRs

---

## 💡 Pro Tips

### Tip 1: Add a Wiki Notice

Add a notice to your wiki Home page:

```markdown
> ⚠ **This wiki is automatically synced from the codebase.**
> 
> **Do not edit this wiki manually** - your changes will be overwritten.
> 
> To update documentation:
> 1. Edit files in the codebase
> 2. Create a pull request
> 3. Wiki will auto-update when merged
```

### Tip 2: Document the Process

Create a wiki page explaining:
- How documentation sync works
- Where to find source files
- How to make changes
- Link to this protection guide

### Tip 3: Monitor Workflow Health

Set up notifications for:
- Workflow failures
- Wiki sync issues
- Permission errors

---

## 🔮 Advanced: Custom Protection

### Using GitHub API

You can use the GitHub API to:
- Check wiki edit permissions
- Verify protection status
- Monitor for unauthorized changes

**Example API call:**
```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/OWNER/REPO
```

Check the `has_wiki` and permissions in the response.

### Using Branch Protection Rules

If you want to treat wiki as a separate repo:
1. Create a dedicated wiki repository
2. Set up branch protection rules
3. Update workflow to create PRs instead of direct pushes
4. Require reviews before merging

**Note:** This is complex and usually unnecessary.

---

## 📚 Related Documentation

- **Documentation Sync Guide**: `.github/docs/DOCUMENTATION_SYNC.md`
- **Sync Workflow**: `.github/workflows/sync-wiki.yml`
- **Migration Script**: `scripts/migrate-wiki.ts`

---

## 🙋 FAQ

### Q: Can I still edit as an admin?

**A:** With Method 1, yes (but discouraged). With Method 2, no.

### Q: What if I need to make an emergency fix?

**A:** 
- Edit the documentation in the codebase
- Push to main (or create a hotfix PR)
- Wiki will auto-update
- This ensures all changes are tracked

### Q: Can workflows still update?

**A:** Yes! Workflows use `GITHUB_TOKEN` which has special permissions that bypass UI restrictions.

### Q: What about the wiki git repository?

**A:** The wiki is a separate git repository. You can clone it and push directly, but this bypasses the protection. Use the workflow instead.

### Q: How do I know if protection is working?

**A:** Try editing a wiki page manually. If you get a permission error, protection is working!

---

**Remember:** The goal is to make the codebase the single source of truth. All documentation changes should go through code review in the main repository. The wiki is just a convenient, automatically-updated view of that documentation! 🚀

