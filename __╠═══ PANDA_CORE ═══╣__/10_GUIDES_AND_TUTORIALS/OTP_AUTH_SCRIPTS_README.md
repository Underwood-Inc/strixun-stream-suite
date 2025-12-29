# Log Tailer Helper Scripts

**Last Updated:** 2025-12-29

Interactive helper scripts to tail Cloudflare Worker logs with smart guidance and explanations.

## Available Scripts

### Unix/Linux/macOS (Bash)
**File:** `tail-logs.sh`

### Windows (PowerShell)
**File:** `tail-logs.ps1`

## Quick Start

### Option 1: Using npm/pnpm (Recommended - Auto-detects OS)

From the `otp-auth-service` directory:

```bash
pnpm tail:helper
```

or

```bash
npm run tail:helper
```

This will automatically run the appropriate script for your operating system.

### Option 2: Direct Execution

#### Unix/Linux/macOS:
```bash
# Make executable (first time only)
chmod +x scripts/tail-logs.sh

# Run the script
./scripts/tail-logs.sh
```

or

```bash
bash scripts/tail-logs.sh
```

#### Windows:
```powershell
# Run from PowerShell
.\scripts\tail-logs.ps1
```

or

```powershell
powershell -ExecutionPolicy Bypass -File scripts\tail-logs.ps1
```

## Features

The scripts provide an interactive menu with the following options:

1. **Real-time Stream (Live)** - Stream logs continuously as they happen
2. **View Recent Logs (Dashboard)** - Open Cloudflare Dashboard for historical logs
3. **Real-time Stream (with Instructions)** - Stream logs with helpful instructions
4. **Error Logs Only** - Stream only error responses (4xx and 5xx status codes)
5. **Filter by Status Code** - Filter logs by specific HTTP status codes
6. **Filter by HTTP Method** - Filter logs by HTTP method (GET, POST, etc.)
7. **Production Environment** - View logs from production environment
8. **Production Stream (with Instructions)** - Stream production logs with instructions
9. **Open Cloudflare Dashboard** - Open the Cloudflare Dashboard in your browser
0. **Exit** - Exit the script

## What Each Option Does

### Real-time Stream (Live)
- **Best for:** Monitoring active traffic in real-time
- **Behavior:** Streams logs continuously until you press Ctrl+C
- **Use case:** Debugging live issues, monitoring API usage

### View Recent Logs (Dashboard)
- **Best for:** Viewing historical/recent logs
- **Behavior:** Opens Cloudflare Dashboard in browser
- **Use case:** When you need to see past logs (CLI only supports real-time streaming)
- **Note:** `wrangler tail` doesn't support viewing historical logs - use the dashboard

### Real-time Stream (with Instructions)
- **Best for:** Learning how to use log streaming
- **Behavior:** Streams logs with helpful instructions displayed first
- **Use case:** When you're new to log tailing or need a reminder

### Error Logs Only
- **Best for:** Finding issues quickly
- **Behavior:** Streams only 4xx and 5xx status codes
- **Use case:** Debugging errors, finding failed requests

### Filter by Status Code
- **Best for:** Focusing on specific response types
- **Behavior:** Prompts for comma-separated status codes (e.g., 200,404,500)
- **Use case:** Analyzing specific response patterns

### Filter by HTTP Method
- **Best for:** Analyzing specific request types
- **Behavior:** Prompts for HTTP method (GET, POST, PUT, DELETE, etc.)
- **Use case:** Debugging specific API endpoints

### Production Environment
- **Best for:** Monitoring production traffic
- **Behavior:** Streams logs from production environment (requires confirmation)
- **Use case:** Production debugging, monitoring live service

### Production Stream (with Instructions)
- **Best for:** Learning how to stream production logs safely
- **Behavior:** Streams production logs with helpful instructions (requires confirmation)
- **Use case:** When you need to monitor production with guidance

### Open Cloudflare Dashboard
- **Best for:** Advanced log viewing and historical analysis
- **Behavior:** Opens browser to Cloudflare Dashboard
- **Use case:** Viewing historical logs, advanced filtering, searching

## Prerequisites

- **wrangler CLI** must be installed and in your PATH
  - Install with: `npm install -g wrangler` or `pnpm add -g wrangler`
- Script must be run from the `otp-auth-service` directory (where `wrangler.toml` is located)
- You must be authenticated with Cloudflare (`wrangler login`)

## Troubleshooting

### "wrangler CLI is not installed"
Install wrangler globally:
```bash
npm install -g wrangler
# or
pnpm add -g wrangler
```

### "wrangler.toml not found"
Make sure you're running the script from the `otp-auth-service` directory:
```bash
cd serverless/otp-auth-service
./scripts/tail-logs.sh  # or .\scripts\tail-logs.ps1 on Windows
```

### "Permission denied" (Unix/Linux/macOS)
Make the script executable:
```bash
chmod +x scripts/tail-logs.sh
```

### PowerShell Execution Policy Error (Windows)
Run PowerShell as Administrator and set execution policy:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or run with bypass flag:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\tail-logs.ps1
```

## Notes

- **Important:** `wrangler tail` only supports real-time streaming, not historical logs
- To view recent/past logs, you must use the Cloudflare Dashboard (options 2 or 9)
- The scripts automatically detect your environment and provide appropriate guidance
- Production options require confirmation to prevent accidental access
- All commands use the `wrangler tail` command under the hood
- The Cloudflare Dashboard provides more advanced features like time-range filtering and search
- Historical logs require Cloudflare Logpush setup for programmatic access

## Script Features

- **Color-coded output** for better readability
- **Smart explanations** for each option
- **Input validation** to prevent errors
- **Cross-platform support** (Unix and Windows)
- **Automatic environment detection**
- **Safety confirmations** for production access
