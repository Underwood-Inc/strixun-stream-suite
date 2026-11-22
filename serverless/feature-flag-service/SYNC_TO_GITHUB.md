# Sync local `strixun-stream-suite` → GitHub

**Status (2026-11-22):** Workspace at `C:\Users\mamop\Documents\__CODE\strixun-stream-suite` has **no** `.git` directory. No other local clone was found under the user profile. **Do not push** until you confirm you want this copy on `Underwood-Inc/strixun-stream-suite`.

`gh auth status` — OK (`mamokin`, repo scope). Remote: `https://github.com/Underwood-Inc/strixun-stream-suite` (default branch `master`).

## One-shot sync (PowerShell)

```powershell
$src = "C:\Users\mamop\Documents\__CODE\strixun-stream-suite"
$clone = "C:\Users\mamop\Documents\__CODE\strixun-stream-suite-git"

git clone https://github.com/Underwood-Inc/strixun-stream-suite.git $clone
robocopy $src $clone /MIR /XD node_modules .wrangler dist .git /XF *.log /NFL /NDL /NJH /NJS /nc /ns /np
Set-Location $clone
git status -sb
# Review diff; then only if intended:
# git add -A
# git commit -m "chore: sync local workspace"
# git push origin master
```

**`/MIR`** deletes files in the clone that are absent locally — review `git status` before commit. Exclude secrets (`.dev.vars`, tokens) manually if any appear.

## Alternative: init git in place

Only if you want this folder to become the canonical working tree:

```powershell
Set-Location "C:\Users\mamop\Documents\__CODE\strixun-stream-suite"
git init
git remote add origin https://github.com/Underwood-Inc/strixun-stream-suite.git
git fetch origin
git checkout -b master origin/master
# Resolve conflicts if the tree diverged; then commit local changes and push when ready.
```