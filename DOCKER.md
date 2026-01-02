# Docker Development Guide

**🐳 Docker Compose provides an isolated, reproducible development environment for Strixun Stream Suite.**

## Quick Start

### Prerequisites
- Docker Desktop installed
- Docker Compose v2+

### Setup

1. **Setup environment files:**
```bash
pnpm setup:cloud-ide
```

2. **Start all services:**
```bash
# Start all services
pnpm docker:dev

# Or build and start (first time or after Dockerfile changes)
pnpm docker:dev:build

# Stop all services
pnpm docker:dev:down
```

## Services

| Service | Port | URL |
|---------|------|-----|
| Mods Hub | 3001 | http://localhost:3001 |
| Stream Suite | 5173 | http://localhost:5173 |
| Control Panel | 5175 | http://localhost:5175 |
| OTP Auth Service | 8787 | http://localhost:8787 |
| Mods API | 8788 | http://localhost:8788 |
| Customer API | 8790 | http://localhost:8790 |

## Features

### ✅ Hot Reload
- Source code changes reflect immediately
- No need to restart containers
- Works for both frontend and backend

### ✅ Persistent Storage
- Wrangler local storage (R2/KV) persisted in Docker volumes
- Data survives container restarts
- Separate volumes per service

### ✅ Isolated Network
- Services communicate via Docker network
- No port conflicts with local services
- Clean separation from host machine

### ✅ Environment Variables
- Uses `.dev.vars` and `.env` files from host
- Test mode enabled by default (emails intercepted)
- No external services required

## Volume Mounts

**Mounted:**
- Source code (for hot reload)
- Environment files (`.dev.vars`, `.env`)

**Excluded:**
- `node_modules` (uses container's installed modules)
- `.wrangler` (uses Docker volumes for persistence)

## Docker Volumes

Persistent volumes for Wrangler state:
- `wrangler-state-otp` - OTP Auth Service storage
- `wrangler-state-mods` - Mods API storage
- `wrangler-state-customer` - Customer API storage

**Clear volumes:**
```bash
docker-compose down -v
```

## Development Workflow

### First Time Setup
```bash
# 1. Setup environment files
pnpm setup:cloud-ide

# 2. Build and start all services
pnpm docker:dev:build

# 3. Wait for all services to start (check logs)
docker-compose logs -f
```

### Daily Development
```bash
# Start services
pnpm docker:dev

# View logs
docker-compose logs -f [service-name]

# Stop services
pnpm docker:dev:down
```

### Making Changes
1. Edit code on host machine
2. Changes automatically reflect in containers (hot reload)
3. Check logs if something doesn't work

## Troubleshooting

### Services Not Starting
```bash
# Check logs
docker-compose logs

# Rebuild containers
pnpm docker:dev:build

# Check if ports are in use
netstat -an | grep -E '3001|5173|5175|8787|8788|8790'
```

### Hot Reload Not Working
- Ensure source code is mounted (check `docker-compose.yml`)
- Check file permissions
- Restart containers: `docker-compose restart`

### Wrangler Storage Issues
```bash
# Clear Wrangler volumes
docker-compose down -v

# Restart services
pnpm docker:dev:build
```

### Node Modules Issues
```bash
# Rebuild containers (reinstalls node_modules)
pnpm docker:dev:build
```

## Benefits vs Local Development

| Aspect | Docker | Local |
|--------|--------|-------|
| **Isolation** | ✅ Complete | ❌ Uses host Node.js |
| **Reproducibility** | ✅ Same for everyone | ⚠️ Depends on host setup |
| **Cleanup** | ✅ `docker-compose down` | ⚠️ Manual cleanup |
| **Port Conflicts** | ✅ Isolated | ⚠️ Can conflict |
| **Setup Time** | ⚠️ First build slower | ✅ Faster |
| **Resource Usage** | ⚠️ Higher (containers) | ✅ Lower |

## When to Use Docker

**Use Docker when:**
- ✅ You want a completely isolated environment
- ✅ You're onboarding new developers
- ✅ You want consistent setup across team
- ✅ You're testing deployment scenarios
- ✅ You have Node.js version conflicts

**Use Local when:**
- ✅ You want fastest iteration
- ✅ You're comfortable with local setup
- ✅ You need to debug with local tools
- ✅ You're working on a single service

## Advanced Usage

### Run Single Service
```bash
docker-compose up mods-hub
```

### Execute Commands in Container
```bash
# Run command in mods-hub container
docker-compose exec mods-hub pnpm test

# Run command in mods-api container
docker-compose exec mods-api pnpm test
```

### View Service Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f mods-hub

# Last 100 lines
docker-compose logs --tail=100 mods-hub
```

### Rebuild Single Service
```bash
docker-compose up --build mods-hub
```

## Notes

- **This is an alternative**, not a replacement for local development
- Use whichever workflow works best for you
- Docker setup uses same environment files as local dev
- All services use test mode (emails intercepted, no external APIs)
