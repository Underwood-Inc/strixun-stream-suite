# OTP Auth Service - Log Tailer Helper Script (PowerShell)
# Interactive script to tail Cloudflare Worker logs with smart guidance

# Service name
$SERVICE_NAME = "otp-auth-service"

# Function to print header
function Print-Header {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  OTP Auth Service - Cloudflare Worker Log Tailer" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
}

# Function to print section header
function Print-Section {
    param([string]$Title)
    Write-Host "----------------------------------------------------------------" -ForegroundColor Blue
    Write-Host "  $Title" -ForegroundColor Blue
    Write-Host "----------------------------------------------------------------" -ForegroundColor Blue
    Write-Host ""
}

# Function to print option with explanation
function Print-Option {
    param(
        [string]$Number,
        [string]$Title,
        [string]$Description
    )
    Write-Host "[$Number] " -ForegroundColor Green -NoNewline
    Write-Host "$Title" -ForegroundColor White
    Write-Host "    -> " -ForegroundColor Yellow -NoNewline
    Write-Host "$Description"
    Write-Host ""
}

# Function to print info
function Print-Info {
    param([string]$Message)
    Write-Host "[i] " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

# Function to print warning
function Print-Warning {
    param([string]$Message)
    Write-Host "⚠ " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

# Function to print error
function Print-Error {
    param([string]$Message)
    Write-Host "[X] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

# Function to print success
function Print-Success {
    param([string]$Message)
    Write-Host "✓ " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

# Check if wrangler is installed
function Test-Wrangler {
    try {
        $null = Get-Command wrangler -ErrorAction Stop
        return $true
    } catch {
        Print-Error "wrangler CLI is not installed or not in PATH"
        Write-Host ""
        Print-Info "Install it with: npm install -g wrangler"
        Write-Host "  or: pnpm add -g wrangler"
        exit 1
    }
}

# Check if we're in the right directory
function Test-Directory {
    if (-not (Test-Path "wrangler.toml")) {
        Print-Error "wrangler.toml not found. Please run this script from the otp-auth-service directory."
        exit 1
    }
}

# Main menu
function Show-Menu {
    Clear-Host
    Print-Header
    
    Print-Section "Log Viewing Options"
    
    Print-Option "1" "Real-time Stream (Live)" `
        "Stream logs continuously as they happen. Best for monitoring active traffic. Press Ctrl+C to stop."
    
    Print-Option "2" "View Recent Logs (Dashboard)" `
        "Open Cloudflare Dashboard to view recent/historical logs. CLI only supports real-time streaming."
    
    Print-Option "3" "Real-time Stream (with Instructions)" `
        "Stream logs with helpful instructions. Use Ctrl+C to stop."
    
    Print-Option "4" "Error Logs Only" `
        "Stream only error responses (4xx and 5xx status codes). Great for finding issues quickly."
    
    Print-Option "5" "Filter by Status Code" `
        "Filter logs by specific HTTP status codes (e.g., 200, 404, 500). You'll be prompted for codes."
    
    Print-Option "6" "Filter by HTTP Method" `
        "Filter logs by HTTP method (GET, POST, PUT, DELETE, etc.). You'll be prompted for method."
    
    Print-Option "7" "Production Environment" `
        "View logs from production environment. Uses --env production flag."
    
    Print-Option "8" "Production Stream (with Instructions)" `
        "Stream production logs with helpful instructions. Use Ctrl+C to stop."
    
    Print-Option "9" "Open Cloudflare Dashboard" `
        "Open the Cloudflare Dashboard in your browser for advanced log viewing and filtering."
    
    Print-Option "0" "Exit" `
        "Exit the script without tailing logs."
    
    Write-Host ""
    Print-Section "Selection"
    Write-Host "Enter your choice [0-9]: " -ForegroundColor White -NoNewline
}

# Execute tail command
function Invoke-TailCommand {
    param(
        [string]$EnvFlag = "",
        [string]$LimitFlag = "",
        [string]$StatusFilter = "",
        [string]$MethodFilter = ""
    )
    
    $cmd = "wrangler tail"
    
    # Add environment flag if specified
    if ($EnvFlag) {
        $cmd += " $EnvFlag"
    }
    
    # Note: wrangler tail doesn't support --limit flag
    # Limit functionality removed - use dashboard for historical logs
    
    # Add status filter if specified
    if ($StatusFilter) {
        $cmd += " --status $StatusFilter"
    }
    
    # Add method filter if specified
    if ($MethodFilter) {
        $cmd += " --method $MethodFilter"
    }
    
    Write-Host ""
    Print-Section "Executing Command"
    Print-Info "Running: $cmd"
    Write-Host ""
    Print-Warning "Press Ctrl+C to stop streaming (if applicable)"
    Write-Host ""
    
    # Execute the command
    Invoke-Expression $cmd
}

# Main script
function Main {
    Test-Wrangler
    Test-Directory
    
    while ($true) {
        Show-Menu
        $choice = Read-Host
        
        Write-Host ""
        
        switch ($choice) {
            "1" {
                Print-Section "Real-time Log Streaming"
                Print-Info "Starting real-time log stream..."
                Invoke-TailCommand
                break
            }
            "2" {
                Print-Section "View Recent Logs (Dashboard)"
                Print-Info "Opening Cloudflare Dashboard for historical log viewing..."
                Print-Warning "Note: wrangler tail only supports real-time streaming, not historical logs."
                
                $dashboardUrl = "https://dash.cloudflare.com"
                
                try {
                    Start-Process $dashboardUrl
                } catch {
                    Print-Warning "Could not automatically open browser."
                    Print-Info "Please visit: $dashboardUrl"
                }
                
                Write-Host ""
                Print-Info "Once in the dashboard:"
                Write-Host "  1. Go to Workers & Pages"
                Write-Host "  2. Click on '$SERVICE_NAME'"
                Write-Host "  3. Click on the 'Logs' tab"
                Write-Host "  4. Use filters to search and view historical logs"
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
            "3" {
                Print-Section "Stream with Instructions"
                Print-Info "Starting real-time log stream..."
                Print-Warning "Note: wrangler tail only supports real-time streaming."
                Print-Info "For historical logs, use the Cloudflare Dashboard (option 2 or 9)."
                Write-Host ""
                Print-Info "Press Ctrl+C when you want to stop streaming."
                Write-Host ""
                Read-Host "Press Enter to start streaming"
                Invoke-TailCommand
                break
            }
            "4" {
                Print-Section "Error Logs Only"
                Print-Info "Streaming only error responses (4xx, 5xx)..."
                Invoke-TailCommand -StatusFilter "error"
                break
            }
            "5" {
                Print-Section "Filter by Status Code"
                Write-Host "Enter status codes (comma-separated, e.g., 200,404,500): " -ForegroundColor White -NoNewline
                $statusCodes = Read-Host
                if ($statusCodes) {
                    Print-Info "Filtering logs by status codes: $statusCodes"
                    Invoke-TailCommand -StatusFilter $statusCodes
                } else {
                    Print-Error "No status codes provided."
                    Write-Host ""
                    Read-Host "Press Enter to continue"
                }
                break
            }
            "6" {
                Print-Section "Filter by HTTP Method"
                Write-Host "Enter HTTP method (GET, POST, PUT, DELETE, etc.): " -ForegroundColor White -NoNewline
                $method = Read-Host
                if ($method) {
                    $method = $method.ToUpper()
                    Print-Info "Filtering logs by method: $method"
                    Invoke-TailCommand -MethodFilter $method
                } else {
                    Print-Error "No method provided."
                    Write-Host ""
                    Read-Host "Press Enter to continue"
                }
                break
            }
            "7" {
                Print-Section "Production Real-time Logs"
                Print-Warning "This will stream logs from PRODUCTION environment"
                Write-Host "Continue? [y/N]: " -ForegroundColor White -NoNewline
                $confirm = Read-Host
                if ($confirm -match '^[Yy]$') {
                    Print-Info "Starting real-time log stream from production..."
                    Invoke-TailCommand -EnvFlag "--env production"
                } else {
                    Print-Info "Cancelled."
                    Write-Host ""
                    Read-Host "Press Enter to continue"
                }
                break
            }
            "8" {
                Print-Section "Production Stream with Instructions"
                Print-Warning "This will stream logs from PRODUCTION environment"
                Write-Host "Continue? [y/N]: " -ForegroundColor White -NoNewline
                $confirm = Read-Host
                if ($confirm -match '^[Yy]$') {
                    Print-Info "Starting real-time log stream from production..."
                    Print-Warning "Note: wrangler tail only supports real-time streaming."
                    Print-Info "For historical logs, use the Cloudflare Dashboard (option 9)."
                    Write-Host ""
                    Print-Info "Press Ctrl+C when you want to stop streaming."
                    Write-Host ""
                    Read-Host "Press Enter to start streaming"
                    Invoke-TailCommand -EnvFlag "--env production"
                } else {
                    Print-Info "Cancelled."
                    Write-Host ""
                    Read-Host "Press Enter to continue"
                }
                break
            }
            "9" {
                Print-Section "Opening Cloudflare Dashboard"
                Print-Info "Opening browser to Cloudflare Dashboard..."
                
                $dashboardUrl = "https://dash.cloudflare.com"
                
                try {
                    Start-Process $dashboardUrl
                } catch {
                    Print-Warning "Could not automatically open browser."
                    Print-Info "Please visit: $dashboardUrl"
                    Print-Info "Then navigate to: Workers & Pages  $SERVICE_NAME  Logs"
                }
                
                Write-Host ""
                Print-Info "Once in the dashboard:"
                Write-Host "  1. Go to Workers & Pages"
                Write-Host "  2. Click on '$SERVICE_NAME'"
                Write-Host "  3. Click on the 'Logs' tab"
                Write-Host "  4. Use filters to search and view historical logs"
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
            "0" {
                Print-Section "Exiting"
                Print-Info "Goodbye!"
                exit 0
            }
            default {
                Print-Error "Invalid option. Please choose 0-9."
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
        }
    }
}

# Run main function
Main

