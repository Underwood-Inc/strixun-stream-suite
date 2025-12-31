# Packages Reorganization - Detailed Plan

## Critical Dependencies to Update

### `@strixun/api-framework` (serverless/shared/api/)
- Imports from: `../../../src/core/api/` [EMOJI] Will become `../../src/core/api/`
- Imports from: `../encryption/index.js` [EMOJI] Will become `../encryption/index.js` (encryption also moves)

### Encryption (serverless/shared/encryption/)
- Currently referenced by: `serverless/shared/api/index.ts`
- Should move to: `packages/encryption/` OR stay with api-framework?

## Decision: Should encryption be separate or part of api-framework?

Looking at the code:
- `api-framework` re-exports encryption utilities
- Encryption is used independently in some places
- **Decision**: Keep encryption separate as `@strixun/encryption` package

## Target Structure

```
packages/
├── api-framework/          # @strixun/api-framework (re-exports from src/core/api + encryption)
├── encryption/             # @strixun/encryption (standalone encryption utilities)
├── service-client/         # @strixun/service-client
├── types/                  # @strixun/types
├── otp-login/             # @strixun/otp-login
├── search-query-parser/   # @strixun/search-query-parser
├── virtualized-table/      # @strixun/virtualized-table
├── rate-limit-info/        # @strixun/rate-limit-info
├── status-flair/           # @strixun/status-flair
├── tooltip/                # @strixun/tooltip
├── ad-carousel/            # @strixun/ad-carousel
├── error-mapping/          # @strixun/error-mapping
└── idle-game-overlay/      # @strixun/idle-game-overlay
```

## Path Updates Required

### After moving to packages/:
1. `serverless/shared/api/index.ts`:
   - `../../../src/core/api/` [EMOJI] `../../src/core/api/`
   - `../encryption/index.js` [EMOJI] `../encryption/index.js` (if encryption also in packages/)

2. All imports using `@strixun/*` will continue to work (workspace packages)

3. Update pnpm-workspace.yaml:
   - Remove: `serverless/shared/api`, `serverless/shared/service-client`, `serverless/shared/types`
   - Remove: `shared-components`, `shared-components/*`
   - Add: `packages/*`

