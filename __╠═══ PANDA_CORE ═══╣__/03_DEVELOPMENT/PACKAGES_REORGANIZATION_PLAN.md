# Packages Reorganization Plan

## Current State Analysis

### Libraries (Should be in `packages/`)
1. **Serverless Libraries** (currently in `serverless/shared/`):
   - `@strixun/api-framework` [EMOJI] `serverless/shared/api/`
   - `@strixun/service-client` [EMOJI] `serverless/shared/service-client/`
   - `@strixun/types` [EMOJI] `serverless/shared/types/`

2. **Component Libraries** (currently in `shared-components/`):
   - `@strixun/otp-login` [EMOJI] `shared-components/otp-login/`
   - `@strixun/search-query-parser` [EMOJI] `shared-components/search-query-parser/`
   - `@strixun/virtualized-table` [EMOJI] `shared-components/virtualized-table/`
   - `@strixun/rate-limit-info` [EMOJI] `shared-components/rate-limit-info/`
   - `@strixun/status-flair` [EMOJI] `shared-components/status-flair/`
   - `@strixun/tooltip` [EMOJI] `shared-components/tooltip/`
   - `@strixun/ad-carousel` [EMOJI] `shared-components/ad-carousel/`
   - `@strixun/error-mapping` [EMOJI] `shared-components/error-mapping/`
   - `@strixun/idle-game-overlay` [EMOJI] `shared-components/idle-game-overlay/`

3. **Service with Library Export**:
   - `@strixun/otp-auth-service` [EMOJI] `serverless/otp-auth-service/` (service, but exports `./utils/crypto`)

### Applications (Should stay where they are)
- `@strixun/mods-hub` [EMOJI] `mods-hub/` (application)
- `@strixun/control-panel` [EMOJI] `control-panel/` (application)
- `@strixun/url-shortener-app` [EMOJI] `serverless/url-shortener/app/` (application)
- Main app [EMOJI] `src/` (application)

### Meta Packages (Review needed)
- `@strixun/shared-components` [EMOJI] `shared-components/` (Storybook meta package - may need to stay or be reorganized)

## Target Structure

```
packages/
├── api-framework/          # @strixun/api-framework
├── service-client/         # @strixun/service-client
├── types/                  # @strixun/types
├── otp-login/              # @strixun/otp-login
├── search-query-parser/    # @strixun/search-query-parser
├── virtualized-table/      # @strixun/virtualized-table
├── rate-limit-info/        # @strixun/rate-limit-info
├── status-flair/           # @strixun/status-flair
├── tooltip/                # @strixun/tooltip
├── ad-carousel/            # @strixun/ad-carousel
├── error-mapping/          # @strixun/error-mapping
└── idle-game-overlay/      # @strixun/idle-game-overlay

apps/
├── mods-hub/               # @strixun/mods-hub
├── control-panel/          # @strixun/control-panel
└── main/                   # Main app (src/)

serverless/
├── otp-auth-service/       # Service (exports library utils)
├── mods-api/              # Service
├── customer-api/           # Service
├── ... (other services)
└── shared/                 # Remove (libraries moved to packages/)
```

## Migration Strategy

### Phase 1: Create packages/ directory structure
1. Create `packages/` directory
2. Move serverless libraries from `serverless/shared/` to `packages/`
3. Move component libraries from `shared-components/` to `packages/`
4. Update all package.json paths

### Phase 2: Update imports
1. Update all imports to use workspace packages (already done, but verify)
2. Update pnpm-workspace.yaml
3. Test that all imports still work

### Phase 3: Cleanup
1. Remove empty `serverless/shared/` directory (if empty)
2. Remove or reorganize `shared-components/` (keep Storybook if needed)
3. Update documentation

## Special Considerations

### `@strixun/otp-auth-service`
- This is a SERVICE, not a library
- However, it exports `./utils/crypto` as a library
- **Decision**: Keep in `serverless/otp-auth-service/` but ensure it's clear it's a service with library exports

### `@strixun/shared-components`
- Currently a meta package for Storybook
- **Decision**: Either:
  - Keep in `shared-components/` for Storybook
  - Or move Storybook to a separate `apps/storybook/` or `tools/storybook/`

### `shared-config/` and `shared-styles/`
- These are NOT libraries, they're shared config/styles
- **Decision**: Keep where they are or move to a `shared/` directory at root

