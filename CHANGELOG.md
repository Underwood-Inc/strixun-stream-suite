# strixun-stream-suite

## 1.4.0

### Minor Changes

- [`0798c8b`](https://github.com/Underwood-Inc/strixun-stream-suite/commit/0798c8b8e626298765569a7561593ca61fc67720) - feat: Add Source Layout Presets system
  - New `source_layouts.lua` script for saving and applying layout presets
  - Capture all source positions, sizes, and visibility states in one click
  - Apply saved layouts with smooth multi-source animation
  - Stagger animation support for cinematic transitions
  - Smart source diffing (handles missing/new sources gracefully)
  - Scene-specific layout filtering
  - Hotkey support (1-9) for quick layout switching
  - New "📐 Layouts" tab in Control Panel with full UI
  - Full export/import/backup integration

- [`9cfbd21`](https://github.com/Underwood-Inc/strixun-stream-suite/commit/9cfbd21aa4c916eb577ea249fe55298f5c240448) - feat: remote client obs setting retrieval

- [`12a3899`](https://github.com/Underwood-Inc/strixun-stream-suite/commit/12a38997233cc0809262c468d7c2033dd87b9155) - feat: carousel and many fixes as well as architecture for upcoming features

- [`cb09f5e`](https://github.com/Underwood-Inc/strixun-stream-suite/commit/cb09f5eba0ba033d0f90662e2d35b0859c7591d4) - feat: comprehensive documentation suite, fix worker encoding, and update GitHub workflows

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

- [`763500a`](https://github.com/Underwood-Inc/strixun-stream-suite/commit/763500ab279768e2683f32f14ccc19a2bd678e95) - feat: url shortener and security

- [`78961c6`](https://github.com/Underwood-Inc/strixun-stream-suite/commit/78961c660601defd55bfda091de70bd585239219) - feat: overhaul logging panel and setup tab

- [`6de379b`](https://github.com/Underwood-Inc/strixun-stream-suite/commit/6de379b9d2a55755fc41c9ce11f3537c36be2ff0) - feat: enhance OTP authentication service with JWT encryption, new dashboard, and improved UX
  - Add JWT-based encryption/decryption for dashboard data (backward compatible)
  - Implement new Svelte dashboard with analytics, API key management, and audit logs
  - Add landing page with Swagger UI integration for interactive API documentation
  - Refactor OtpLogin component into smaller composable components (EmailForm, OtpForm, ErrorDisplay)
  - Enhance error handling with error mapping system and tooltip support for rate limits
  - Improve authentication flow with customer account auto-creation and enhanced signup process
  - Add rate limiting improvements with super-admin endpoints and countdown displays
  - Update shared components (RateLimitInfoCard, ErrorDisplay, Tooltip) for better embedded usage
  - Implement pnpm workspaces for centralized dependency management
  - Enhance build processes, deployment workflows, and health checks
  - Add comprehensive documentation for idle game system and API endpoints
  - Update configuration with shared styles support and improved warning suppression

### Patch Changes

- [`562a02b`](https://github.com/Underwood-Inc/strixun-stream-suite/commit/562a02b70d7a1499d85e4b3ac672ce465e534f23) - feat(meta): add Open Graph and Twitter meta tags for improved social sharing

- [`0af5499`](https://github.com/Underwood-Inc/strixun-stream-suite/commit/0af5499f159a70db987c5a51ca41608c45873706) - style: add contrast safe color adjustments for text
