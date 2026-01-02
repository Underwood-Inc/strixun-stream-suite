# Build System Documentation

## Overview

This monorepo uses **Turborepo** for build orchestration and **pnpm workspaces** for dependency management. All build outputs are centralized in the root `dist/` directory with subdirectories for each project.

## Architecture

### Build System Stack

- **Turborepo**: Task orchestration, dependency graph resolution, and caching
- **pnpm workspaces**: Package management and dependency hoisting
- **Vite**: Frontend build tool (Svelte, React apps)
- **TypeScript**: Type checking and compilation
- **esbuild**: Fast bundling for libraries

### Output Directory Structure

All projects output to `dist/<project-name>/`:

```
dist/
├── stream-suite/          # Root Svelte app (main OBS Studio toolkit)
├── mods-hub/              # React app
├── control-panel/         # React app (single-file)
├── dice-board-game/       # Library package
├── otp-login/            # Library package (react, vanilla, svelte variants)
│   ├── react/
│   └── js/
├── otp-auth-service/     # Svelte app
├── otp-auth-service-dashboard/  # Svelte dashboard
├── url-shortener-app/     # React app
└── api-framework/         # TypeScript library
```

## Build Commands

### Root Level Commands

```bash
# Build all projects (respects dependency order)
pnpm build

# Build only library packages
pnpm build:packages

# Build only applications
pnpm build:apps

# Force rebuild (ignore cache)
pnpm build:clean

# Run all tests
pnpm test:all

# Lint all projects
pnpm lint:all

# Check all projects (type checking, linting, building)
pnpm check:all
```

### Project-Specific Commands

```bash
# Build a specific project
pnpm --filter @strixun/mods-hub build

# Build with dependencies
turbo run build --filter=@strixun/mods-hub

# Run dev server for a project
pnpm --filter @strixun/mods-hub dev
```

## Dependency Graph

### Build Dependencies

Turborepo automatically resolves build dependencies based on workspace package dependencies:

1. **Library Packages** (no dependencies):
   - `@strixun/api-framework`
   - `@strixun/types`
   - `@strixun/service-client`

2. **Library Packages** (depend on other packages):
   - `@strixun/otp-login` → depends on `@strixun/api-framework`
   - `@strixun/dice-board-game` → standalone

3. **Applications** (depend on libraries):
   - `mods-hub` → depends on `@strixun/otp-login`, `@strixun/dice-board-game`
   - `control-panel` → depends on `@strixun/otp-login`
   - `otp-auth-service/dashboard` → depends on `@strixun/otp-login`, `@strixun/api-framework`
   - `url-shortener/app` → depends on `@strixun/otp-login`

### How Turborepo Handles Dependencies

The `^build` syntax in `turbo.json` means:
- Build all workspace dependencies **before** building this package
- Automatically parallelize builds where safe
- Cache builds based on inputs and dependencies

Example: When building `mods-hub`:
1. Turborepo detects it depends on `@strixun/otp-login` and `@strixun/dice-board-game`
2. Builds those packages first (in parallel if possible)
3. Then builds `mods-hub`
4. Caches all results for future builds

## Configuration

### turbo.json

Located at the root, defines:
- Task pipelines (build, test, lint, etc.)
- Output directories for caching
- Environment variables
- Dependency relationships

Key configuration (Turborepo 2.x uses `tasks` instead of `pipeline`):
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],  // Build dependencies first
      "outputs": ["dist/**"],
      "env": ["VITE_*", "NODE_ENV"]
    }
  }
}
```

### Project Vite Configs

All projects use absolute paths for `outDir`:
```typescript
build: {
  outDir: path.resolve(__dirname, '../dist/project-name'),
  // ...
}
```

This ensures consistent output locations regardless of where the build is run from.

## Build Process

### Standard Build Flow

1. **Dependency Resolution**: Turborepo analyzes workspace dependencies
2. **Task Scheduling**: Builds are scheduled based on dependency graph
3. **Parallel Execution**: Independent builds run in parallel
4. **Caching**: Build outputs are cached based on inputs
5. **Output**: All builds write to `dist/<project-name>/`

### Special Cases

#### OTP Login Package

The `@strixun/otp-login` package has multiple build variants:
- `build`: Builds vanilla + React (default)
- `build:react`: React components only
- `build:vanilla`: Vanilla JS only
- `build:svelte`: Svelte components only

Projects that need specific variants should ensure the variant is built before their build runs. Turborepo handles this via the dependency graph.

#### URL Shortener

The `url-shortener` package has a complex multi-step build:
- Builds OTP login
- Bundles decrypt script
- Bundles OTP core
- Builds app
- Bundles app assets

This is handled by custom scripts in `serverless/url-shortener/package.json`.

## Caching

### How It Works

Turborepo caches build outputs based on:
- Source file contents (hashed)
- Dependency build outputs
- Environment variables (if specified)
- Task configuration

### Cache Benefits

- **Faster builds**: Unchanged packages skip building
- **CI/CD efficiency**: Shared cache across runs
- **Developer productivity**: Local cache speeds up dev cycles

### Cache Invalidation

Caches are invalidated when:
- Source files change
- Dependencies change
- Environment variables change
- `turbo.json` configuration changes

Force rebuild (ignore cache):
```bash
pnpm build:clean
# or
turbo run build --force
```

## Troubleshooting

### Build Fails with "Dependency not found"

**Problem**: A package tries to import from a dependency that hasn't been built yet.

**Solution**: Ensure the dependency is listed in `package.json` dependencies. Turborepo will build it automatically.

### Build Output in Wrong Location

**Problem**: Build outputs to local `dist/` instead of root `dist/`.

**Solution**: Check `vite.config.ts` or `tsconfig.json` - ensure `outDir` uses `path.resolve(__dirname, '../dist/project-name')`.

### Cache Issues

**Problem**: Build seems to use stale cache.

**Solution**: 
```bash
# Clear Turborepo cache
rm -rf .turbo

# Force rebuild
pnpm build:clean
```

### Prebuild Scripts Not Running

**Problem**: Old `prebuild` scripts were removed - builds fail.

**Solution**: Turborepo handles dependencies automatically. If you need a specific build variant (e.g., `build:react`), ensure the dependency package has that script and it's listed in `turbo.json`.

### VITE_SERVICE_ENCRYPTION_KEY Errors

**Problem**: Build fails with errors about missing `VITE_SERVICE_ENCRYPTION_KEY`.

**Solution**: This environment variable is **no longer required**. Service key encryption has been removed. All encryption now uses JWT tokens. If you see this error:
- Check if you're using an outdated build script (e.g., `build-with-key.js`)
- Update your build command to use the standard `pnpm build` or `turbo run build`
- Remove any references to `VITE_SERVICE_ENCRYPTION_KEY` from your build configuration

### Turborepo Output Warnings

**Problem**: Turborepo shows warnings like "No output files found" during builds.

**Solution**: This is **expected and harmless**. Since all builds output to the root `dist/` directory using absolute paths, Turborepo (which looks for outputs relative to each package directory) won't find them. The builds still work correctly and caching still functions properly. This is an informational warning only and can be safely ignored.

## Environment Variables

### Build-Time Variables

Turborepo automatically passes `VITE_*` prefixed environment variables to all build tasks. Common variables:

- `VITE_BASE_PATH`: Base path for deployment (e.g., `/` for root, `/app/` for subdirectory)
- `NODE_ENV`: Build environment (`development` or `production`)

### Removed: VITE_SERVICE_ENCRYPTION_KEY

**⚠️ IMPORTANT**: `VITE_SERVICE_ENCRYPTION_KEY` has been **completely removed** from the build system.

- **Service key encryption was removed**: The `encryptWithServiceKey()` function has been removed from `@strixun/api-framework`
- **JWT encryption only**: All encryption now uses JWT tokens via the API framework
- **No build-time key required**: The `otp-auth-service` dashboard build no longer requires `VITE_SERVICE_ENCRYPTION_KEY`
- **Legacy scripts**: The `build-with-key.js` script in `serverless/otp-auth-service/scripts/` is obsolete and not used by the build system

If you encounter references to `VITE_SERVICE_ENCRYPTION_KEY` in:
- **Documentation**: These are outdated and should be updated
- **GitHub Actions workflows**: These may still reference it but it's not required for builds
- **Legacy scripts**: Scripts like `build-with-key.js` are no longer used

## Migration Notes

### What Changed

1. **Removed `prebuild` scripts**: Turborepo handles dependencies automatically
2. **Standardized output paths**: All projects use absolute paths to root `dist/`
3. **Unified build commands**: Use `turbo run` instead of manual pnpm filters
4. **Centralized configuration**: Build dependencies defined in `turbo.json`
5. **Removed service key encryption**: `VITE_SERVICE_ENCRYPTION_KEY` no longer required - all encryption uses JWT

### Backward Compatibility

- Old pnpm filter commands still work: `pnpm --filter @strixun/otp-login build`
- Individual project scripts unchanged: `pnpm build` in a project directory still works
- Turborepo wraps existing build scripts - no changes needed to Vite/TypeScript configs

## Best Practices

1. **Always use root commands**: `pnpm build` instead of building packages individually
2. **Let Turborepo handle dependencies**: Don't add manual `prebuild` scripts
3. **Check cache first**: Turborepo will tell you if a build was cached
4. **Use filters for specific builds**: `turbo run build --filter=@strixun/mods-hub`
5. **Keep outputs in dist/**: Never commit `dist/` to git (already in `.gitignore`)

## Future Improvements

- [ ] Add remote caching (Vercel or self-hosted)
- [ ] Optimize build order for maximum parallelism
- [ ] Add build visualization (Turborepo UI)
- [ ] Set up build performance monitoring
