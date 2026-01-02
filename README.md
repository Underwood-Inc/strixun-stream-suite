# 🎯 Strixun's Stream Suite

<div align="center">

![Version](https://img.shields.io/badge/version-1.3.0-blue?style=for-the-badge&logo=github)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![OBS Studio](https://img.shields.io/badge/OBS%20Studio-28%2B-orange?style=for-the-badge&logo=obsstudio)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge)
![Coverage](https://codecov.io/gh/Underwood-Inc/strixun-stream-suite/branch/master/graph/badge.svg)

**A comprehensive OBS Studio production toolkit for professional streaming**

*Source animations, layout presets, text cycling, and Twitch integration - all in one powerful suite*

[Quick Start](#quick-start) • [Documentation](#documentation) • [Issues](https://github.com/Underwood-Inc/strixun-stream-suite/issues) • [Discussions](https://github.com/Underwood-Inc/strixun-stream-suite/discussions)

</div>

---

## 📋 Overview

**Strixun's Stream Suite** is a comprehensive monorepo containing a professional streaming toolkit and a full ecosystem of applications, services, and reusable packages. This repository includes everything from OBS Studio control panels to mod hosting platforms, authentication services, game components, and shared libraries.

---

## 🎯 Applications

### Main OBS Control Panel (Root Project)
**Location:** `./` (root)  
**Tech:** Svelte 5, TypeScript, Vite, PWA  
**Purpose:** Primary OBS Studio control panel for streamers

**Features:**
- Source Animations (fade, slide, zoom, pop effects)
- Source Swaps (animated position swapping)
- Layout Presets (save and apply entire scene layouts)
- Text Cycler (cycle text with animated transitions)
- Twitch Clips Player (auto-play clips during BRB screens)
- Unified Control Panel (one dock to control everything)
- PWA Support (Progressive Web App with offline capabilities)
- Multi-layer Storage (IndexedDB + localStorage + Recovery system)

**See:** [README.md](./README.md) (this file) for main app documentation

---

### Control Panel
**Location:** [`control-panel/`](./control-panel/)  
**Tech:** React 19, TypeScript, Vite, vite-plugin-singlefile  
**Purpose:** React-based single-file bundle control panel for OBS Studio docks

**See:** [control-panel/README.md](./control-panel/README.md)

---

### Mods Hub
**Location:** [`mods-hub/`](./mods-hub/)  
**Tech:** React 19, TypeScript, Vite, TanStack Query, Zustand  
**Purpose:** Modern mod hosting platform (similar to Modrinth)

**Features:**
- Mod upload & management
- Version control with semantic versioning
- Search & filtering
- Direct download links
- Beautiful gold-themed UI
- Integrated OTP authentication

**See:** [mods-hub/README.md](./mods-hub/README.md)

---

### Dice Board Game
**Location:** [`dice-board-game/`](./dice-board-game/)  
**Tech:** React 19, Three.js, React Three Fiber, Zustand  
**Purpose:** 3D dice rolling board game component

**Features:**
- Hexagonal board system with procedural generation
- 3D dice rolling with realistic physics
- 3000+ procedural event scenarios
- React Three Fiber integration
- Standalone or overlay mode

**See:** [dice-board-game/README.md](./dice-board-game/README.md)

---

## 📦 Packages

### Core Infrastructure

#### `@strixun/api-framework`
**Location:** [`packages/api-framework/`](./packages/api-framework/)  
**Purpose:** Shared API framework for Cloudflare Workers and browsers

**Features:**
- Type-safe API clients
- Request deduplication
- Automatic retry with exponential backoff
- Multi-level caching
- Request queue with priorities
- Circuit breaker
- Offline queue
- Optimistic updates
- E2E encryption
- RFC 7807 error handling

**See:** [packages/api-framework/README.md](./packages/api-framework/README.md)

#### `@strixun/service-client`
**Location:** [`packages/service-client/`](./packages/service-client/)  
**Purpose:** Service client utilities with integrity checking

**See:** [packages/service-client/README.md](./packages/service-client/README.md)

#### `@strixun/types`
**Location:** [`packages/types/`](./packages/types/)  
**Purpose:** Shared TypeScript type definitions

**See:** [packages/types/README.md](./packages/types/README.md)

#### `@strixun/auth-store`
**Location:** [`packages/auth-store/`](./packages/auth-store/)  
**Purpose:** Authentication state management with Svelte and Zustand adapters

**See:** [packages/auth-store/README.md](./packages/auth-store/README.md)

---

### UI Components & Libraries

#### `@strixun/otp-login`
**Location:** [`packages/otp-login/`](./packages/otp-login/)  
**Purpose:** Standalone OTP Login UI library (CDN-ready)

**Features:**
- Vanilla JS, React, and Svelte variants
- CDN deployment support
- Email OTP flow
- JWT token management

**See:** [packages/otp-login/README.md](./packages/otp-login/README.md)

#### `@strixun/virtualized-table`
**Location:** [`packages/virtualized-table/`](./packages/virtualized-table/)  
**Purpose:** High-performance virtualized table component for React

**Features:**
- Handles thousands of rows efficiently
- Sortable columns
- Row selection
- Customizable styling

**See:** [packages/virtualized-table/README.md](./packages/virtualized-table/README.md)

#### `@strixun/search-query-parser`
**Location:** [`packages/search-query-parser/`](./packages/search-query-parser/)  
**Purpose:** Advanced search query parser with human-friendly syntax

**Features:**
- Quoted exact phrases
- AND/OR logic
- Wildcard prefix matching
- React and Svelte components

**See:** [packages/search-query-parser/README.md](./packages/search-query-parser/README.md)

#### `@strixun/asciimoji`
**Location:** [`packages/asciimoji/`](./packages/asciimoji/)  
**Purpose:** ASCII emoji library with pattern matching

**See:** [packages/asciimoji/README.md](./packages/asciimoji/README.md)

#### `@strixun/ad-carousel`
**Location:** [`packages/ad-carousel/`](./packages/ad-carousel/)  
**Purpose:** Ad carousel component for Svelte with Twitch integration

**See:** [packages/ad-carousel/README.md](./packages/ad-carousel/README.md)

#### `@strixun/status-flair`
**Location:** [`packages/status-flair/`](./packages/status-flair/)  
**Purpose:** Status badge/flair component

**See:** [packages/status-flair/README.md](./packages/status-flair/README.md)

#### `@strixun/tooltip`
**Location:** [`packages/tooltip/`](./packages/tooltip/)  
**Purpose:** Tooltip component library with Storybook

**See:** [packages/tooltip/README.md](./packages/tooltip/README.md)

#### `@strixun/rate-limit-info`
**Location:** [`packages/rate-limit-info/`](./packages/rate-limit-info/)  
**Purpose:** Rate limit information display component

**See:** [packages/rate-limit-info/README.md](./packages/rate-limit-info/README.md)

#### `@strixun/idle-game-overlay`
**Location:** [`packages/idle-game-overlay/`](./packages/idle-game-overlay/)  
**Purpose:** Idle game overlay components

**Features:**
- Character customization
- Crafting system
- Dungeons
- Loot systems
- Inventory management

**See:** [packages/idle-game-overlay/README.md](./packages/idle-game-overlay/README.md)

---

### Testing & Utilities

#### `@strixun/e2e-helpers`
**Location:** [`packages/e2e-helpers/`](./packages/e2e-helpers/)  
**Purpose:** E2E testing helpers with email interception and fixtures

**See:** [packages/e2e-helpers/README.md](./packages/e2e-helpers/README.md)

#### `@strixun/error-mapping`
**Location:** [`packages/error-mapping/`](./packages/error-mapping/)  
**Purpose:** Error mapping utilities with error legend

**See:** [packages/error-mapping/README.md](./packages/error-mapping/README.md)

---

## ☁️ Serverless Services (Cloudflare Workers)

### Authentication & User Management

#### `otp-auth-service`
**Location:** [`serverless/otp-auth-service/`](./serverless/otp-auth-service/)  
**Purpose:** Multi-tenant OTP authentication service

**Features:**
- Email OTP authentication
- JWT token management
- API key management (multi-tenant)
- Analytics dashboard
- OpenAPI 3.1.0 spec
- Swagger UI integration
- Developer dashboard (Svelte 5)

**See:** [serverless/otp-auth-service/README.md](./serverless/otp-auth-service/README.md)

#### `customer-api`
**Location:** [`serverless/customer-api/`](./serverless/customer-api/)  
**Purpose:** Customer data management API with full CRUD operations

**See:** [serverless/customer-api/README.md](./serverless/customer-api/README.md)

---

### Content & Mod Management

#### `mods-api`
**Location:** [`serverless/mods-api/`](./serverless/mods-api/)  
**Purpose:** Dedicated mod hosting and version control API

**Features:**
- Mod upload & management
- Version control with semantic versioning
- R2 storage integration
- Client-side encryption
- Default compression
- Direct download links

**See:** [serverless/mods-api/README.md](./serverless/mods-api/README.md)

#### `url-shortener`
**Location:** [`serverless/url-shortener/`](./serverless/url-shortener/)  
**Purpose:** URL shortening service with OTP authentication

**Features:**
- Create and manage short URLs
- Click analytics tracking
- Standalone web interface
- Custom URL codes
- Automatic expiration

**See:** [serverless/url-shortener/README.md](./serverless/url-shortener/README.md)

---

### Integration Services

#### `twitch-api`
**Location:** [`serverless/twitch-api/`](./serverless/twitch-api/)  
**Purpose:** Twitch API proxy with cloud storage and CDN endpoints

**See:** [serverless/twitch-api/README.md](./serverless/twitch-api/README.md)

#### `chat-signaling`
**Location:** [`serverless/chat-signaling/`](./serverless/chat-signaling/)  
**Purpose:** WebRTC signaling server for P2P chat

**Features:**
- Room management
- WebRTC offer/answer exchange
- Room discovery
- Automatic cleanup (TTL-based)
- Heartbeat system

**See:** [serverless/chat-signaling/README.md](./serverless/chat-signaling/README.md)

#### `game-api`
**Location:** [`serverless/game-api/`](./serverless/game-api/)  
**Purpose:** Idle game API endpoints for game state management

**Features:**
- Save/load game state
- Player progress tracking
- Achievement system

**See:** [serverless/game-api/README.md](./serverless/game-api/README.md)

---

## 🎨 Shared Resources

### `shared-components`
**Location:** [`shared-components/`](./shared-components/)  
**Purpose:** Shared component library with Storybook documentation

**See:** [shared-components/README.md](./shared-components/README.md)

### `shared-config`
**Location:** [`shared-config/`](./shared-config/)  
**Purpose:** Shared configuration files and utilities

**See:** [shared-config/README.md](./shared-config/README.md)

### `shared-styles`
**Location:** [`shared-styles/`](./shared-styles/)  
**Purpose:** Shared SCSS styles and design tokens

**Features:**
- Design tokens (colors, spacing, typography)
- Animation system
- Mixins (buttons, inputs, cards)
- Framework-agnostic SCSS

**See:** [shared-styles/README.md](./shared-styles/README.md)

---

## 📚 Documentation

### Technical Documentation
- **`docs/`** - Technical documentation, API references, and architecture guides
- **`product-docs/`** - Product documentation for end users
- **`╠═══════ PANDA_CORE ═══════╣/`** - Core documentation hub with 350+ markdown files

### Project-Specific Documentation
Each project has its own README with detailed setup and development instructions. See individual project directories listed above.

---

---

## 🚀 Quick Start (Main OBS Control Panel)

> **Note:** This quick start is for the **Main OBS Control Panel** (root project). For other projects, see their individual README files listed in the [Overview](#-overview) section above.

### For GitHub Pages Users (Recommended)

If you're viewing this on GitHub, the easiest way to use Strixun Stream Suite is via GitHub Pages:

#### Step 1: Navigate to GitHub Pages URL

Simply open your browser and go to:

```
https://underwood-inc.github.io/strixun-stream-suite
```

> **Note:** If you've forked this repository, your URL will be `https://YOUR-USERNAME.github.io/strixun-stream-suite`

#### Step 2: Add to OBS Studio as a Dock

1. Open **OBS Studio**
2. Go to **View Docks ★ Custom Browser Docks**
3. Click **"+"** to add a new dock
4. Enter a name (e.g., "Stream Suite")
5. Paste your GitHub Pages URL: `https://underwood-inc.github.io/strixun-stream-suite`
6. Click **OK**

#### Step 3: Connect to OBS

The control panel will automatically attempt to connect to OBS via WebSocket. Make sure:

- OBS Studio is running
- WebSocket Server is enabled in **OBS > Tools > WebSocket Server Settings**
- Default port is **4455** (or configure custom port)

#### Step 4: Install Scripts (First Time Only)

1. In the control panel dock, click the **Install** tab
2. Follow the installation wizard
3. Restart OBS Studio when prompted
4. Configure your scripts in the **Scripts** tab

---

## ★ What You'll See

### Initial Setup Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Strixun's Stream Suite - Control Panel                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Connection Status                                     │ │
│  │  ⚠ Not Connected                                     │ │
│  │  Connecting to OBS WebSocket (localhost:4455)...       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Installer Tab                                         │ │
│  │                                                        │ │
│  │  Welcome! Let's get you set up:                        │ │
│  │                                                        │ │
│  │  [1] Generate Install Script                           │ │
│  │  [2] Run Script (Windows/Mac/Linux)                    │ │
│  │  [3] Restart OBS                                       │ │
│  │  [4] Configure Scripts                                 │ │
│  │                                                        │ │
│  │  [> Start Installation]                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### After Installation - Main Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Strixun's Stream Suite v1.3.0                              │
├─────────────────────────────────────────────────────────────┤
│  Dashboard  Sources  Text  Swaps  Layouts                   │
│  Scripts   Install   Setup                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ Connected to OBS (localhost:4455)                     │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Quick Actions                                         │ │
│  │                                                        │ │
│  │  [Animate Source]  [Swap Sources]                      │ │
│  │  [Apply Layout]    [Cycle Text]                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Script Status                                         │ │
│  │                                                        │ │
│  │  ✓ Source Animations (v2.8.1)                       │ │
│  │  ✓ Source Swap (v3.1.0)                             │ │
│  │  ✓ Source Layouts (v1.0.0)                          │ │
│  │  ✓ Text Cycler (v1.0.0)                             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Adding a Dock in OBS Studio (Visual Guide)

```
┌─────────────────────────────────────────────────────────────┐
│  OBS Studio                                                 │
├─────────────────────────────────────────────────────────────┤
│  File  Edit  View  Docks  Tools  Help                       │
│                                                             │
│  View Docks ★ Custom Browser Docks ★ ✓                  │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Add Custom Browser Dock                               │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  Dock Name: [Stream Suite                  ]           │ │
│  │                                                        │ │
│  │  URL:                                                  │ │
│  │  ┌───────────────────────────────────────────────────┐ │ │
│  │  │ https://underwood-inc.github.io/                  │ │ │
│  │  │ strixun-stream-suite                              │ │ │
│  │  └───────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  [  Cancel  ]  [  OK  ]                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Control Panel Tabs Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Tab Navigation                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dashboard  ->  Quick access to common actions              │
│  Sources    ->  Configure source visibility animations      │
│  Text       ->  Set up text cycler configurations           │
│  Swaps      ->  Create source swap presets                  │
│  Layouts    ->  Save and apply layout presets               │
│  Scripts    ->  View script status and manage               │
│  Install    ->  Installation wizard (first time)            │
│  Setup      ->  Connection and storage settings             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ★ Features

| Feature | Description |
|---------|-------------|
| **Source Animations** | Fade, slide, zoom, pop effects on visibility toggle |
| ** ★ Source Swap** | Swap position and size of two sources with animation |
| ** Source Layouts** | Save and apply layout presets with multi-source animation |
| ** ★ Text Cycler** | Cycle text with animated transitions (obfuscate, typewriter, glitch, wave) |
| **[PERF] Quick Controls** | Hotkey to cycle aspect override mode |
| ** Script Manager** | Unified dashboard for all animation scripts |
| ** ★ ️ Control Panel** | Web-based dock UI to control everything |
| ** Twitch Clips Player** | Auto-play Twitch clips with chat command support |
| ** ★ Scrollbar Customizer** | Free CDN-hosted tool to customize scrollbars on any website |

---

## ★ Requirements

- **OBS Studio 28+** (includes WebSocket support)
- **No additional plugins needed** - works out of the box!

---

<details>
<summary><strong>🚀 Developer Setup - Local Development & Cloud IDE</strong></summary>

### Quick Answer: Cloudflare Setup for Local Dev

**❌ NO Cloudflare account needed for local development!**

When using `wrangler dev --local` (default in all dev scripts):
- ✅ R2 buckets stored locally in `~/.wrangler/state/v3/r2/`
- ✅ KV namespaces stored locally in `~/.wrangler/state/v3/kv/`
- ✅ No cloud access required
- ✅ Works completely offline
- ✅ No costs

Cloudflare setup is **only needed for production deployment**.

---

### Minimum Steps to Clone and Run Locally

#### Prerequisites
- Node.js 18+ (`node --version`)
- pnpm 9+ (`npm install -g pnpm@9.15.1`)
- Git

#### Step 1: Clone and Install
```bash
git clone <repository-url>
cd "source fade script plugin"
pnpm install
```

#### Step 2: Configure OTP Auth Service (Required for Authentication)

**🔒 IMPORTANT: Local dev uses test mode - emails are intercepted, NOT sent via Resend!**

For local development, emails are **intercepted and logged to console** - no Resend API calls are made. This prevents consuming your Resend quota during development.

**Option A: Use Test Mode (Recommended - No Resend Account Needed)**

1. **Run the setup script:**
```bash
cd serverless/otp-auth-service
pnpm setup:test-secrets
```

This automatically creates `.dev.vars` with:
- `ENVIRONMENT=test` (enables email interception)
- `RESEND_API_KEY=re_test_key_for_local_development` (test key, not a real API key)
- All other required test secrets

**✅ OTP Codes:** OTP codes are intercepted and printed to the console. Check the wrangler dev output for `[DEV] OTP Code for email@example.com: 123456789`

**Option B: Manual Setup (If you prefer)**

1. **Create `.dev.vars` file:**
```bash
cd serverless/otp-auth-service
cp .dev.vars.example .dev.vars
```

2. **Edit `serverless/otp-auth-service/.dev.vars` with test mode:**
```bash
# CRITICAL: ENVIRONMENT=test enables email interception (no Resend API calls)
ENVIRONMENT=test

# JWT Secret (use standard dev value)
JWT_SECRET=test-jwt-secret-for-local-development-12345678901234567890123456789012

# Test API key (NOT a real Resend key - emails are intercepted)
RESEND_API_KEY=re_test_key_for_local_development

# Test email (not used, but required)
RESEND_FROM_EMAIL=test@example.com

# Network Integrity (for service-to-service calls)
NETWORK_INTEGRITY_KEYPHRASE=test-integrity-keyphrase-for-integration-tests
```

**✅ OTP Codes:** OTP codes are intercepted and printed to console. No emails are sent, no Resend API is consumed.

**⚠️ Production Note:** For production deployment, you'll need a real Resend account and API key. But for local dev, test mode is recommended to avoid consuming your Resend quota.

#### Step 3: Configure Mods API (If Using Mods Hub)

1. **Create `.dev.vars` file:**
```bash
cd serverless/mods-api
cp .dev.vars.example .dev.vars
```

2. **Edit `serverless/mods-api/.dev.vars`** (use standard dev values):
```bash
# Use 'test' or 'development' - both work for local dev
ENVIRONMENT=test
JWT_SECRET=test-jwt-secret-for-local-development-12345678901234567890123456789012
NETWORK_INTEGRITY_KEYPHRASE=test-integrity-keyphrase-for-integration-tests
CUSTOMER_API_URL=http://localhost:8790
ALLOWED_ORIGINS=*
MODS_ENCRYPTION_KEY=strixun_mods_encryption_key_dev_2025_secure_random_64_char_minimum_required_for_pbkdf2_derivation
```

#### Step 4: Configure Customer API (If Using Mods Hub)

1. **Create `serverless/customer-api/.dev.vars`:**
```bash
cd serverless/customer-api
```

2. **Create `.dev.vars` file:**
```bash
JWT_SECRET=test-jwt-secret-for-local-development-12345678901234567890123456789012
NETWORK_INTEGRITY_KEYPHRASE=test-integrity-keyphrase-for-integration-tests
ENVIRONMENT=test
```

#### Step 5: Configure Mods Hub Frontend (If Using Mods Hub)

The `.env` file is **auto-generated** by `setup:env.js` when you run `pnpm dev`, but you can create it manually:

**Create `mods-hub/.env`:**
```bash
# Shared encryption key for mod file encryption
# Must match MODS_ENCRYPTION_KEY in serverless/mods-api/.dev.vars
VITE_MODS_ENCRYPTION_KEY=strixun_mods_encryption_key_dev_2025_secure_random_64_char_minimum_required_for_pbkdf2_derivation
```

**Note:** The `predev` script automatically runs `setup:env.js`, so this file is created on first run.

#### Step 6: Start Development Servers

**Option A: Full Stack (Mods Hub + All Services)**
```bash
cd mods-hub
pnpm dev:all
```

This starts:
- Frontend: http://localhost:3001
- Mods API: http://localhost:8788
- OTP Auth Service: http://localhost:8787
- Customer API: http://localhost:8790

**Option B: Main OBS Control Panel Only**
```bash
# From root directory
pnpm dev
```
Runs at: http://localhost:5173

**Option C: All Services (Turborepo)**
```bash
# From root directory
pnpm dev:turbo
```
Starts all frontend apps and backend workers simultaneously.

---

### Critical Environment Variables

**Must match across all services:**

1. **JWT_SECRET** - Standard dev value: `test-jwt-secret-for-local-development-12345678901234567890123456789012`
   - Used by: otp-auth-service, mods-api, customer-api, url-shortener, chat-signaling, twitch-api, game-api

2. **NETWORK_INTEGRITY_KEYPHRASE** - Standard dev value: `test-integrity-keyphrase-for-integration-tests`
   - Used by: otp-auth-service, mods-api, customer-api

3. **MODS_ENCRYPTION_KEY** (Mods Hub only) - Standard dev value: `strixun_mods_encryption_key_dev_2025_secure_random_64_char_minimum_required_for_pbkdf2_derivation`
   - Must match between `mods-hub/.env` (VITE_MODS_ENCRYPTION_KEY) and `serverless/mods-api/.dev.vars` (MODS_ENCRYPTION_KEY)

---

### Cloud IDE Compatibility (CodeSandbox, StackBlitz, etc.)

**✅ Yes, the codebase works in cloud IDEs with minimum setup!**

**Quick Setup (One Command - No Manual Copy/Paste Needed!):**

Run this single command to automatically create all required environment files:

```bash
pnpm setup:cloud-ide
```

That's it! The script automatically creates:
- `serverless/otp-auth-service/.dev.vars`
- `serverless/mods-api/.dev.vars`
- `serverless/customer-api/.dev.vars`
- `mods-hub/.env`

All files are pre-configured with test mode defaults (emails intercepted, no Resend API calls). **No manual copy/paste required!**

After running the script, you can immediately start development:
```bash
cd mods-hub
pnpm dev:all
```

**Manual Setup (Alternative):**

If you prefer to create files manually, here are the exact contents:

<details>
<summary><strong>📋 Manual File Contents (Click to Expand)</strong></summary>

**1. Create `serverless/otp-auth-service/.dev.vars`:**
```bash
ENVIRONMENT=test
JWT_SECRET=test-jwt-secret-for-local-development-12345678901234567890123456789012
NETWORK_INTEGRITY_KEYPHRASE=test-integrity-keyphrase-for-integration-tests
RESEND_API_KEY=re_test_key_for_local_development
RESEND_FROM_EMAIL=test@example.com
ALLOWED_ORIGINS=*
SUPER_ADMIN_EMAILS=test@example.com
```

**2. Create `serverless/mods-api/.dev.vars`:**
```bash
ENVIRONMENT=test
JWT_SECRET=test-jwt-secret-for-local-development-12345678901234567890123456789012
NETWORK_INTEGRITY_KEYPHRASE=test-integrity-keyphrase-for-integration-tests
CUSTOMER_API_URL=http://localhost:8790
ALLOWED_ORIGINS=*
MODS_ENCRYPTION_KEY=strixun_mods_encryption_key_dev_2025_secure_random_64_char_minimum_required_for_pbkdf2_derivation
```

**3. Create `serverless/customer-api/.dev.vars`:**
```bash
ENVIRONMENT=test
JWT_SECRET=test-jwt-secret-for-local-development-12345678901234567890123456789012
NETWORK_INTEGRITY_KEYPHRASE=test-integrity-keyphrase-for-integration-tests
```

**4. Create `mods-hub/.env`:**
```bash
VITE_MODS_ENCRYPTION_KEY=strixun_mods_encryption_key_dev_2025_secure_random_64_char_minimum_required_for_pbkdf2_derivation
```

</details>

**Requirements:**
1. **Test Mode Setup** - Use `ENVIRONMENT=test` and `RESEND_API_KEY=re_test_key_for_local_development` (no real Resend account needed)
2. **Auto-generate `.dev.vars`** - Run `node scripts/setup-cloud-ide.js` or `pnpm setup:test-secrets` in `serverless/otp-auth-service`
3. **Wrangler Local Storage** - Works in sandbox environments (uses local filesystem)
4. **Port Configuration** - All ports are pre-configured and won't conflict

**Recommended Setup Script for Cloud IDEs:**
```bash
# Auto-generate all .dev.vars files with dev defaults
# Use RESEND_API_KEY from environment variable
node scripts/setup-cloud-ide.js
```

**What Works:**
- ✅ All R2 storage → local filesystem
- ✅ All KV storage → local filesystem  
- ✅ All workers → run locally via `wrangler dev --local`
- ✅ All frontend apps → run locally via Vite
- ✅ Authentication → works with local workers
- ✅ OTP codes → intercepted and logged to console (no emails sent)
- ✅ File uploads → stored locally
- ✅ Database operations → use local KV storage

**External Services Required:**
- **None for local dev!** Test mode intercepts emails (no Resend account needed)
- **Resend.com** (only needed for production deployment)

---

### Docker Compose Development (Alternative)

**🐳 Docker Compose provides an isolated, reproducible development environment!**

**Prerequisites:**
- Docker Desktop installed
- Docker Compose v2+

**Quick Start:**

1. **Setup environment files:**
```bash
pnpm setup:cloud-ide
```

2. **Start all services:**
```bash
# Start all services
pnpm docker:dev

# Or build and start
pnpm docker:dev:build

# Stop all services
pnpm docker:dev:down
```

**What's Included:**
- ✅ All frontend apps (Mods Hub, Stream Suite, Control Panel)
- ✅ All backend workers (OTP Auth, Mods API, Customer API)
- ✅ Hot reload enabled (code changes reflect immediately)
- ✅ Wrangler local storage persisted (R2/KV data survives restarts)
- ✅ Isolated network (services communicate via Docker network)
- ✅ Pre-configured ports (same as local dev)

**Services:**
- **Mods Hub**: http://localhost:3001
- **Stream Suite**: http://localhost:5173
- **Control Panel**: http://localhost:5175
- **OTP Auth Service**: http://localhost:8787
- **Mods API**: http://localhost:8788
- **Customer API**: http://localhost:8790

**Benefits:**
- ✅ **Isolated environment** - No conflicts with local Node.js versions
- ✅ **Reproducible** - Same environment for all developers
- ✅ **Easy cleanup** - `docker-compose down` removes everything
- ✅ **Consistent** - Same setup across Windows, Mac, Linux
- ✅ **No local dependencies** - Only Docker needed

**Volume Mounts:**
- Source code mounted for hot reload
- Wrangler state persisted in Docker volumes
- Node modules excluded (faster startup)

**Note:** This is an **alternative** to local development, not a replacement. Use whichever workflow you prefer!

---

### Port Assignments

| Service | Port | Type |
|---------|------|------|
| Stream Suite (Root) | 5173 | Frontend (Vite) |
| Mods Hub | 3001 | Frontend (Vite) |
| Control Panel | 5175 | Frontend (Vite) |
| OTP Auth Worker | 8787 | Backend (Wrangler) |
| Mods API Worker | 8788 | Backend (Wrangler) |
| Customer API Worker | 8790 | Backend (Wrangler) |
| Twitch API Worker | 8789 | Backend (Wrangler) |
| Game API Worker | 8791 | Backend (Wrangler) |
| Chat Signaling Worker | 8792 | Backend (Wrangler) |
| URL Shortener Worker | 8793 | Backend (Wrangler) |

All ports are pre-configured and won't conflict.

---

### Summary

- ❌ **No Cloudflare account needed** for local dev
- ❌ **No Resend account needed** for local dev (test mode intercepts emails)
- ✅ **All storage is local** (R2 and KV)
- ✅ **Works offline**
- ✅ **Standard dev values documented**
- ✅ **Auto-setup scripts exist** (`pnpm setup:test-secrets`)
- ✅ **OTP codes intercepted** - printed to console, no emails sent
- ✅ **Cloud IDE compatible** with minimum setup

**Email Interception:** When `ENVIRONMENT=test` and `RESEND_API_KEY` starts with `re_test_`, emails are intercepted and OTP codes are printed to the console. No Resend API calls are made, preserving your quota for production use.

</details>

---

## ★ Manual Installation (Alternative)

If you prefer to install scripts manually:

1. **Download/Clone** this repository
2. **Copy all `.lua` files** to your OBS scripts folder:
   - **Windows:** `%AppData%\obs-studio\basic\scripts\`
   - **macOS:** `~/Library/Application Support/obs-studio/basic/scripts/`
   - **Linux:** `~/.config/obs-studio/basic/scripts/`
3. **In OBS:** `Tools > Scripts ★ + ★ Select all .lua files`
4. **Add the control panel** as a Custom Browser Dock (use local file path or GitHub Pages URL)

---

## 📁 Project Structure

This monorepo is organized into several categories:

### Applications
- **[Main OBS Control Panel](./)** - Svelte-based OBS Studio toolkit (root project)
- **[Control Panel](./control-panel/)** - React single-file bundle for OBS docks
- **[Mods Hub](./mods-hub/)** - Mod hosting platform (React + TypeScript)
- **[Dice Board Game](./dice-board-game/)** - 3D dice board game component

### Packages (`packages/`)
- **[API Framework](./packages/api-framework/)** - Shared API framework
- **[OTP Login](./packages/otp-login/)** - OTP authentication UI library
- **[Virtualized Table](./packages/virtualized-table/)** - High-performance table component
- **[Search Query Parser](./packages/search-query-parser/)** - Advanced search parser
- **[Auth Store](./packages/auth-store/)** - Authentication state management
- **[Service Client](./packages/service-client/)** - Service client utilities
- **[Types](./packages/types/)** - Shared TypeScript types
- **[E2E Helpers](./packages/e2e-helpers/)** - E2E testing utilities
- **[Error Mapping](./packages/error-mapping/)** - Error mapping utilities
- **[Ad Carousel](./packages/ad-carousel/)** - Ad carousel component
- **[ASCIIMoji](./packages/asciimoji/)** - ASCII emoji library
- **[Idle Game Overlay](./packages/idle-game-overlay/)** - Idle game components
- **[Rate Limit Info](./packages/rate-limit-info/)** - Rate limit display component
- **[Status Flair](./packages/status-flair/)** - Status badge component
- **[Tooltip](./packages/tooltip/)** - Tooltip component

### Serverless Services (`serverless/`)
- **[OTP Auth Service](./serverless/otp-auth-service/)** - Multi-tenant OTP authentication
- **[Mods API](./serverless/mods-api/)** - Mod hosting API
- **[URL Shortener](./serverless/url-shortener/)** - URL shortening service
- **[Customer API](./serverless/customer-api/)** - Customer data management
- **[Twitch API](./serverless/twitch-api/)** - Twitch API proxy
- **[Chat Signaling](./serverless/chat-signaling/)** - WebRTC signaling server
- **[Game API](./serverless/game-api/)** - Idle game API

### Shared Resources
- **[Shared Components](./shared-components/)** - Shared component library
- **[Shared Config](./shared-config/)** - Shared configuration
- **[Shared Styles](./shared-styles/)** - Shared SCSS styles

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

### 📖 For Everyone
- **[Product Overview](./docs/PRODUCT_OVERVIEW.md)** - Understand what Strixun Stream Suite does (non-technical)
- **[Scrollbar Customizer](./serverless/SCROLLBAR_CUSTOMIZER.md)** - Free CDN tool to customize scrollbars on any website (super beginner-friendly!)

### ★ For Developers
- **[Technical Architecture](./docs/TECHNICAL_ARCHITECTURE.md)** - Complete system architecture
- **[API Reference](./docs/API_REFERENCE.md)** - Complete API documentation
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - CI/CD workflows and deployment
- **[Worker Port Mapping](./serverless/WORKER_PORT_MAPPING.md)** - **CRITICAL:** Standard port assignments for local development
- **[Wrangler Troubleshooting](./serverless/TROUBLESHOOTING_WRANGLER.md)** - Common issues and solutions for `wrangler dev`

#### Development Scripts

Run all build and check scripts across all projects to verify everything compiles correctly:

```bash
pnpm check:all
```

This script runs:
- Root project: TypeScript checks, linting, and build
- Control Panel: TypeScript build and linting
- Mods Hub: TypeScript build and linting
- OTP Login: All build variants (vanilla, React, Svelte)
- OTP Auth Service: Svelte checks and build
- OTP Auth Dashboard: Svelte checks and build
- OTP Auth SDK: TypeScript build
- URL Shortener App: Vite build

See [docs/README.md](./docs/README.md) for a complete documentation index.

### 📖 Project-Specific Documentation

Each project has its own README with detailed setup and development instructions:
- See individual project directories for their specific README files
- For comprehensive technical docs, see the [`╠═══════ PANDA_CORE ═══════╣/`](./╠═══════%20PANDA_CORE%20═══════╣/) documentation hub

---

## ★ Troubleshooting

**Scripts not appearing in OBS?**
- Ensure `.lua` files are in the correct scripts folder
- Restart OBS after adding scripts
- Check `Tools > Scripts` for error messages

**Control panel not connecting?**
- Verify OBS WebSocket Server is enabled (`Tools > WebSocket Server Settings`)
- Check that port 4455 is not blocked by firewall
- Try restarting OBS Studio

**Animations not playing?**
- First visibility toggle caches state, second triggers animation
- Check "Animate on SHOW/HIDE" is enabled in script settings
- Click "Refresh Sources" in script settings

**Sources drifting out of position?**
- Click "Recapture Home Positions" in source_animations settings
- This resets the canonical transform cache

---

## Version History

### Control Panel
- **v1.3.0** - Current version
- **v3.0.0** - Multi-layer storage system (IndexedDB + localStorage + Recovery)
- **v2.0.0** - Added installer wizard, script manager, Twitch clips integration

### Scripts
- **Source Animations v2.8.1** - Fixed position drift with canonical transforms
- **Source Swap v3.1.0** - Temporary aspect override in settings
- **Source Layouts v1.0.0** - Save and apply layout presets

---

## ★ License

MIT License - feel free to use and modify.

---

---

<div align="center">

**Made with ❤️ for the streaming community**

[⭐ Star this repo](https://github.com/Underwood-Inc/strixun-stream-suite) • [🐛 Report Bug](https://github.com/Underwood-Inc/strixun-stream-suite/issues) • [💡 Request Feature](https://github.com/Underwood-Inc/strixun-stream-suite/issues)

</div>
