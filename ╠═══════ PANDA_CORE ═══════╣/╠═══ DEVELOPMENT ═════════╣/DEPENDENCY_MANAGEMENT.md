# Dependency Management with pnpm Workspaces

## Overview

This project uses **pnpm workspaces** for efficient dependency management. Shared dependencies like `wrangler` are managed centrally in the root `package.json` with version overrides to ensure consistency across all serverless services.

## Workspace Structure

```
.
├── package.json              # Root workspace - contains shared dependencies
├── pnpm-workspace.yaml       # Defines workspace packages
├── serverless/
│   ├── package.json          # Main serverless package
│   ├── url-shortener/
│   │   └── package.json      # Service-specific deps (wrangler via override)
│   ├── otp-auth-service/
│   │   └── package.json      # Service-specific deps (wrangler via override)
│   └── chat-signaling/
│       └── package.json       # Service-specific deps (wrangler via override)
└── control-panel/
    └── package.json          # Control panel package
```

## How It Works

### 1. Workspace Configuration (`pnpm-workspace.yaml`)

All packages are defined as workspace members, allowing pnpm to:
- Hoist shared dependencies to the root `node_modules`
- Share a single lockfile (`pnpm-lock.yaml`)
- Use workspace protocol for internal dependencies

### 2. Version Overrides (`package.json`)

The root `package.json` includes shared dependencies and overrides:

```json
{
  "devDependencies": {
    "wrangler": "^4.56.0",
    "typescript": "^5.9.3",
    "vite": "^7.3.0"
  },
  "pnpm": {
    "overrides": {
      "wrangler": "^4.56.0",
      "typescript": "^5.9.3",
      "vite": "^7.3.0"
    }
  }
}
```

**What this does:**
- Ensures ALL workspaces use the same versions for shared dependencies
- Even if a service specifies different versions, they'll get the root version via override
- Single source of truth for all shared dependencies
- pnpm automatically hoists these to root `node_modules` for efficiency

### 3. Service Package.json Files

Each service can still declare `wrangler` in its `devDependencies`:

```json
{
  "devDependencies": {
    "wrangler": "^4.56.0"
  }
}
```

**Benefits:**
- Services explicitly declare their dependencies (good for documentation)
- Scripts like `wrangler deploy` work correctly
- The override ensures they all get the same version
- If you remove wrangler from root, services still have it declared

## Updating Dependencies

### Update Shared Dependencies (All Services)

Simply update in the root workspace - it automatically cascades to all workspaces via `pnpm.overrides`:

```powershell
# Update all shared dependencies at once
pnpm add -D -w wrangler@latest typescript@latest vite@latest

# Or update individually
pnpm add -D -w wrangler@latest
pnpm add -D -w typescript@latest
pnpm add -D -w vite@latest

# Sync all workspaces (usually runs automatically after add)
pnpm install
```

**That's it!** The `pnpm.overrides` in root `package.json` ensures all workspaces get the same versions automatically.

### Update Global Wrangler
```powershell
pnpm add -g wrangler@latest
```

## Shared Dependencies

The following dependencies are managed centrally in the root `package.json`:

- **wrangler** - Cloudflare Workers CLI (used by all serverless services)
- **typescript** - TypeScript compiler (used by SDK and control-panel)
- **vite** - Build tool (used by root app and control-panel)

All other dependencies are workspace-specific and managed locally.

## Benefits

✓ **Single Source of Truth**: Update shared deps once in root, all workspaces get it  
✓ **Consistent Versions**: Overrides prevent version drift across workspaces  
✓ **Efficient Storage**: Shared dependencies automatically hoisted to root `node_modules`  
✓ **Fast Installs**: Single lockfile, deduplicated dependencies  
✓ **Workspace Protocol**: Services can reference each other easily  
✓ **Automatic Hoisting**: pnpm automatically hoists shared deps to root  

## Commands Reference

```powershell
# Install all dependencies (all workspaces)
pnpm install

# Add dependency to root workspace
pnpm add -D -w <package>

# Add dependency to specific workspace
pnpm --filter <workspace-name> add -D <package>

# Run script in specific workspace
pnpm --filter url-shortener deploy

# List all workspaces
pnpm -r list
```

## Workspace Names

- `strixun-stream-suite` - Root workspace
- `strixun-twitch-api` - Main serverless package
- `strixun-url-shortener` - URL shortener service
- `otp-auth-service` - OTP authentication service
- `strixun-chat-signaling` - Chat signaling service
- `@strixun/control-panel` - Control panel

## Notes

- The `pnpm.overrides` field ensures version consistency
- Services can still declare dependencies locally (for clarity)
- All dependencies are hoisted to root when possible
- Use `-w` flag to add to root workspace
- Use `--filter` to target specific workspaces
