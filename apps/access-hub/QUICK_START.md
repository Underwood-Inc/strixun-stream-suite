# Access Hub - Quick Start Guide

## What is Access Hub?

Access Hub is the frontend UI for the Strixun Access Control System. It provides a clean, minimal interface for viewing roles and permissions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ACCESS SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (UI)                  Backend (API)               │
│  ┌──────────────────┐          ┌──────────────────┐        │
│  │  Access Hub      │  ──────> │  Access Service  │        │
│  │  React + Vite    │          │  Cloudflare      │        │
│  │                  │          │  Worker          │        │
│  └──────────────────┘          └──────────────────┘        │
│                                                             │
│  access.idling.app              access-api.idling.app       │
│  localhost:5178                 localhost:8795              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9.15.1+
- Access Service running (backend)

### Installation

```bash
# From root of monorepo
cd access-hub
pnpm install
```

### Running Locally

**Option 1: Run Both Frontend + Backend Together (Easiest)**

```bash
cd access-hub
pnpm dev:all
```

This starts:
- Access Hub (frontend) on `http://localhost:5178`
- Access Service (backend) on `http://localhost:8795`

**Option 2: Run Frontend Only**

```bash
cd access-hub
pnpm dev
```

Visit: `http://localhost:5178`

**Option 3: Run with Turbo (All Services)**

```bash
# From root
pnpm dev:turbo

# Check all running ports
pnpm dev:ports
```

## Features

### View Roles

The homepage displays all system roles with:
- Role name and display name
- Description
- Authorization level
- List of permissions

### View Permissions

The homepage also displays all permissions with:
- Permission name and display name
- Description
- Category

## API Integration

Access Hub calls the Access Service API directly:

**Development:**
- Frontend: `http://localhost:5178`
- Backend: `http://localhost:8795`

**Production:**
- Frontend: `https://access.idling.app`
- Backend: `https://access-api.idling.app`

### API Endpoints Used

- `GET /access/roles` - List all roles
- `GET /access/permissions` - List all permissions

## Building for Production

```bash
cd access-hub
pnpm build
```

Output: `../dist/access-hub/`

## Deployment

Deployed via GitHub Actions to Cloudflare Pages:

```bash
# Manual deployment
cd access-hub
pnpm build
pnpm exec wrangler pages deploy ../dist/access-hub --project-name=access-hub
```

## Environment Variables

- `VITE_ACCESS_API_URL` - Access API URL (defaults to `https://access-api.idling.app` in production, `http://localhost:8794` in development)

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console:

1. Check that Access Service is running: `http://localhost:8795/health`
2. Verify `ALLOWED_ORIGINS` includes `http://localhost:5178`
3. Check Vite proxy configuration in `vite.config.ts`

### API Not Responding

1. Ensure Access Service is running on port 8795
2. Check Access Service logs for errors
3. Verify the API URL in the browser console

### Port Already in Use

If port 5178 is already in use:

```bash
# Find and kill the process
netstat -ano | findstr :5178
taskkill /PID <PID> /F

# Or change the port in vite.config.ts
```

## Project Structure

```
access-hub/
├── src/
│   ├── App.tsx           # Main UI component
│   ├── App.css           # Styles
│   ├── main.tsx          # Entry point
│   ├── index.css         # Global styles
│   └── vite-env.d.ts     # TypeScript definitions
├── public/               # Static assets
├── index.html            # HTML template
├── package.json          # Dependencies
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript config
└── README.md             # Documentation
```

## Next Steps

1. ✅ Run `pnpm dev:all` to start both frontend and backend
2. ✅ Visit `http://localhost:5177` to see the UI
3. ✅ Explore roles and permissions
4. ✅ Make changes and see hot reload in action

## Related Documentation

- [Access Service Documentation](../serverless/access-service/README.md)
- [Architecture Refactor](../ACCESS_ARCHITECTURE_REFACTOR.md)
- [Deployment Guide](../.github/workflows/deploy-access-hub.yml)
