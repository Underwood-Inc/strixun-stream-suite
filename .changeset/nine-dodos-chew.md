---
"strixun-stream-suite": minor
---

feat: comprehensive documentation suite, fix worker encoding, and update GitHub workflows

## Fixed Issues

- **Worker Encoding Fix**: Resolved UTF-16 encoding issue in `serverless/worker.js` that prevented Wrangler deployment. File converted from UTF-16 with BOM to UTF-8 without BOM using Python codecs module.

## GitHub Workflows Updated

- **deploy-pages.yml**: Updated paths to reference `serverless/` instead of `twitch_clips_player/serverless/`
  - Fixed `paths-ignore` patterns
  - Updated `WORKER_NAME` grep command path
  - Corrected cleanup command path
  
- **deploy-twitch-api.yml**: Updated working directory and paths to `serverless/`
  - Fixed `on:push` paths trigger
  - Updated `wrangler deploy` and `wrangler secret put` working directories

- **release.yml**: Updated zip exclude pattern to `serverless/*` instead of `twitch_clips_player/serverless/*`

## Documentation Suite Created

Created comprehensive documentation organized for both product owners and technical stakeholders:

### New Documentation Files

- **docs/PRODUCT_OVERVIEW.md**: User-friendly product overview with Mermaid diagrams
  - Explains what the product does in plain language
  - Business value and use cases
  - High-level system flow diagrams
  - Success metrics and getting started guide

- **docs/TECHNICAL_ARCHITECTURE.md**: Complete technical architecture documentation
  - Component architecture with Mermaid diagrams
  - Data flow and communication patterns
  - Storage architecture (IndexedDB, localStorage, Cloudflare KV)
  - API architecture and security model
  - Performance considerations

- **docs/API_REFERENCE.md**: Comprehensive API reference
  - All Twitch API proxy endpoints documented
  - Cloud Storage endpoints with examples
  - Request/response formats
  - Error handling and rate limits
  - Integration examples

- **docs/DATABASE_SCHEMA.md**: Complete storage schema documentation
  - Local storage schemas (IndexedDB, localStorage)
  - Cloud storage schemas (Cloudflare KV)
  - Key patterns and data structures
  - Migration guides

- **docs/DEPLOYMENT.md**: Deployment and operations guide
  - GitHub Actions workflows explained
  - Cloudflare Worker deployment steps
  - GitHub Pages deployment process
  - Environment configuration
  - Monitoring and troubleshooting

- **docs/README.md**: Documentation index and navigation guide
  - Organized by role (Product Owner, Developer, DevOps, etc.)
  - Quick navigation by task
  - Documentation standards and statistics

### Documentation Updates

- **README.md**: 
  - Added "Documentation" section linking to new docs
  - Removed outdated "🎬 Clips" tab reference (UI not implemented, only API exists)

## Documentation Features

- 20+ Mermaid diagrams across all documents
- 30+ code examples
- Complete API endpoint documentation (9 endpoints)
- Storage schema documentation for both local and cloud storage
- User-friendly product owner persona at top, technical details at bottom
- Multiple markdown files for better organization
