# OTP Login Library - Workspace Integration

## Overview

The OTP Login library is fully integrated into the pnpm workspace, ensuring:
- ✓ Proper dependency hoisting
- ✓ Workspace-aware build commands
- ✓ Automatic builds via `prebuild` scripts
- ✓ Efficient dependency management

## Workspace Configuration

### pnpm-workspace.yaml

The workspace includes the OTP login library:

```yaml
packages:
  - 'shared-components'
  - 'shared-components/*'  # Includes @strixun/otp-login
```

### Package Name

The library is registered as `@strixun/otp-login` in the workspace, allowing it to be referenced via workspace filters.

## Build Commands

### Root Workspace Commands

From the root workspace, you can build the OTP library:

```bash
# Build all frameworks
pnpm build:otp-login

# Build specific framework
pnpm build:otp-login:react
pnpm build:otp-login:svelte
pnpm build:otp-login:vanilla
```

### Using Workspace Filters

All projects use pnpm workspace filters to build the library:

```bash
# From any workspace
pnpm --filter @strixun/otp-login build
pnpm --filter @strixun/otp-login build:react
pnpm --filter @strixun/otp-login build:svelte
pnpm --filter @strixun/otp-login build:vanilla
```

## Automatic Builds

### Prebuild Scripts

Each project automatically builds the OTP library before its own build:

**React Projects (mods-hub, control-panel):**
```json
{
  "scripts": {
    "prebuild": "pnpm --filter @strixun/otp-login build:react"
  }
}
```

**Svelte Projects (main app, dashboard, url-shortener app):**
```json
{
  "scripts": {
    "prebuild": "pnpm --filter @strixun/otp-login build:svelte"
  }
}
```

**Vanilla JS Projects (url-shortener worker):**
```json
{
  "scripts": {
    "build:otp-login": "pnpm --filter @strixun/otp-login build:vanilla"
  }
}
```

## Dependency Hoisting

### Automatic Hoisting

pnpm automatically hoists shared dependencies to the root `node_modules`:
- `react`, `react-dom`  Hoisted for React projects
- `svelte`  Hoisted for Svelte projects
- `vite`, `typescript`  Hoisted for all projects
- `@vitejs/plugin-react`, `@sveltejs/vite-plugin-svelte`  Hoisted

### Workspace Dependencies

The OTP library's dependencies are automatically available to consuming projects:
- No need to duplicate dependencies
- Single source of truth in the library's `package.json`
- pnpm resolves workspace dependencies automatically

## Project Integration

### React Projects

**mods-hub/package.json:**
```json
{
  "scripts": {
    "prebuild": "pnpm --filter @strixun/otp-login build:react"
  }
}
```

**control-panel/package.json:**
```json
{
  "scripts": {
    "prebuild": "pnpm --filter @strixun/otp-login build:react"
  }
}
```

### Svelte Projects

**Root package.json (main app):**
```json
{
  "scripts": {
    "prebuild": "pnpm build:otp-login:svelte"
  }
}
```

**serverless/otp-auth-service/dashboard/package.json:**
```json
{
  "scripts": {
    "prebuild": "pnpm --filter @strixun/otp-login build:svelte"
  }
}
```

**serverless/url-shortener/app/package.json:**
```json
{
  "scripts": {
    "prebuild": "pnpm --filter @strixun/otp-login build:svelte"
  }
}
```

## Benefits

1. **Efficient Dependency Management**
   - Shared dependencies hoisted to root
   - No duplicate installations
   - Single lockfile (`pnpm-lock.yaml`)

2. **Workspace-Aware Builds**
   - Use workspace filters instead of `cd` commands
   - Works from any directory
   - Cross-platform compatible

3. **Automatic Builds**
   - `prebuild` scripts ensure library is built before projects
   - No manual build steps needed
   - Consistent across all projects

4. **Single Source of Truth**
   - Library dependencies defined once
   - Version consistency via workspace
   - Easy to update dependencies

## Usage Examples

### Build Library for Development

```bash
# Build all frameworks
pnpm build:otp-login

# Build specific framework
pnpm build:otp-login:react
```

### Build a Project (Automatically Builds Library)

```bash
# React project - automatically builds React components
cd mods-hub
pnpm build  # Runs prebuild first

# Svelte project - automatically builds Svelte components
cd serverless/otp-auth-service/dashboard
pnpm build  # Runs prebuild first
```

### Build from Root

```bash
# Build all OTP login variants
pnpm build:otp-login:all

# Build specific variant
pnpm build:otp-login:svelte
```

## Troubleshooting

### Build Fails

If a build fails, ensure:
1. Dependencies are installed: `pnpm install`
2. Workspace is properly configured: Check `pnpm-workspace.yaml`
3. Library package name is correct: `@strixun/otp-login`

### Dependency Not Found

If dependencies aren't hoisting:
1. Run `pnpm install` from root
2. Check workspace configuration in `pnpm-workspace.yaml`
3. Verify package name matches in `shared-components/otp-login/package.json`

### Workspace Filter Not Working

If workspace filters don't work:
1. Verify package name: `@strixun/otp-login`
2. Check workspace includes `shared-components/*`
3. Run `pnpm install` to sync workspace

## Best Practices

1. **Always use workspace filters** instead of `cd` commands
2. **Build from root** when building all variants
3. **Let prebuild scripts handle** automatic builds
4. **Use workspace protocol** for internal dependencies
5. **Keep dependencies in library** - don't duplicate in projects

