# Mods Hub - Strixun Stream Suite

A modern mod hosting platform built with React, TypeScript, and Cloudflare Workers. Similar to Modrinth but thematically aligned with the Strixun Stream Suite application ecosystem.

## Features

- ✅ **Mod Upload & Management** - Upload, update, and manage your mods
- ✅ **Version Control** - Full semantic versioning with changelogs
- ✅ **Direct Download Links** - Share direct download links in any application
- ✅ **Authentication** - Integrated with OTP auth service
- ✅ **Search & Filtering** - Find mods by category, tags, and search terms
- ✅ **Modern UI** - Beautiful, responsive interface with gold theme
- ✅ **Type-Safe** - Full TypeScript coverage
- ✅ **Scalable** - Built on Cloudflare Workers and R2 storage

## Architecture

This application follows a three-layer state model:

1. **Signals** (`@preact/signals-react`) - UI state (form fields, toggles, filters)
2. **Zustand** - Global client state (auth, UI state, notifications)
3. **TanStack Query** - Server state (mods data, API calls)

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **@preact/signals-react** - UI state
- **styled-components** - Styling

## Setup

### Prerequisites

- Node.js 18+
- pnpm 9+

### Installation

```bash
cd mods-hub
pnpm install
```

### Environment Variables

Create a `.env` file:

```env
VITE_MODS_API_URL=https://mods-api.idling.app
VITE_AUTH_API_URL=https://auth.idling.app
```

### Development

```bash
pnpm dev
```

The app will be available at `http://localhost:3001`

### Build

```bash
pnpm build
```

### Production Deployment

The Mods Hub is automatically deployed to Cloudflare Pages via GitHub Actions when changes are pushed to the `main` branch.

**Production URL:** `https://mods.idling.app`

For deployment setup instructions, see [CLOUDFLARE_PAGES_SETUP.md](./CLOUDFLARE_PAGES_SETUP.md)

## Project Structure

```
mods-hub/
├── src/
│   ├── components/        # React components
│   │   ├── layout/       # Layout components (Header, Layout, etc.)
│   │   └── mod/          # Mod-specific components
│   ├── hooks/            # Custom hooks (TanStack Query hooks)
│   ├── pages/            # Page components
│   ├── services/         # API service layer
│   ├── stores/           # Zustand stores
│   ├── theme/            # Design tokens and global styles
│   └── types/            # TypeScript types
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## API Integration

The frontend communicates with the Cloudflare Worker API at `mods-api.idling.app`:

- `GET /mods` - List mods
- `GET /mods/:modId` - Get mod detail
- `POST /mods` - Upload new mod
- `PATCH /mods/:modId` - Update mod
- `DELETE /mods/:modId` - Delete mod
- `POST /mods/:modId/versions` - Upload version
- `GET /mods/:modId/versions/:versionId/download` - Download version

## Authentication

Authentication is handled through the OTP auth service. Users can:

1. Request OTP via email
2. Verify OTP to get JWT token
3. Use token for authenticated requests

Tokens are stored in `sessionStorage` for security.

## Usage

### Uploading a Mod

1. Log in with your email
2. Navigate to "Upload"
3. Fill in mod details (title, description, category, etc.)
4. Select mod file
5. Optionally add thumbnail
6. Submit

### Managing Versions

1. Go to your mod's detail page
2. Click "Manage" (if you're the author)
3. Upload new versions with changelogs
4. Update mod metadata

### Downloading Mods

1. Browse mods on the home page
2. Click on a mod to view details
3. Select a version and click "Download"
4. Use the direct download link in your applications

## Component Guidelines

All components follow these principles:

- **Composable** - Small, reusable components
- **Type-Safe** - Full TypeScript coverage
- **Agnostic** - No business logic in UI components
- **Flexible** - Props-based configuration

## State Management

### UI State (Signals)

Use `@preact/signals-react` for:
- Form field values
- Toggle states
- Filter values
- Local component state

### Global State (Zustand)

Use Zustand for:
- Authentication state
- UI state (modals, notifications)
- Cross-component state

### Server State (TanStack Query)

Use TanStack Query for:
- All API calls
- Data fetching
- Caching
- Optimistic updates

## Styling

The app uses `styled-components` with a design token system:

- Colors: Gold accent theme matching Strixun Stream Suite
- Spacing: Consistent spacing scale
- Typography: System font stack

## License

Private - Strixun Stream Suite

