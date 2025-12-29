#!/bin/bash

# OTP Auth Service - Log Tailer Helper Script
# Interactive script to tail Cloudflare Worker logs with smart guidance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Service name
SERVICE_NAME="otp-auth-service"

# Function to print header
print_header() {
    echo -e "${CYAN}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║  OTP Auth Service - Cloudflare Worker Log Tailer        ║${NC}"
    echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to print section header
print_section() {
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Function to print option with explanation
print_option() {
    local num=$1
    local title=$2
    local desc=$3
    echo -e "${GREEN}[${num}]${NC} ${BOLD}${title}${NC}"
    echo -e "    ${YELLOW}❓${NC} ${desc}"
    echo ""
}

# Function to print info
print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}❓${NC} $1"
}

# Function to print error
print_error() {
    echo -e "${RED}❓${NC} $1"
}

# Function to print success
print_success() {
    echo -e "${GREEN}❓${NC} $1"
}

# Check if wrangler is installed
check_wrangler() {
    if ! command -v wrangler &> /dev/null; then
        print_error "wrangler CLI is not installed or not in PATH"
        echo ""
        print_info "Install it with: npm install -g wrangler"
        echo "  or: pnpm add -g wrangler"
        exit 1
    fi
}

# Check if we're in the right directory
check_directory() {
    if [ ! -f "wrangler.toml" ]; then
        print_error "wrangler.toml not found. Please run this script from the otp-auth-service directory."
        exit 1
    fi
}

# Main menu
show_menu() {
    clear
    print_header
    
    print_section "Log Viewing Options"
    
    print_option "1" "Real-time Stream (Live)" \
        "Stream logs continuously as they happen. Best for monitoring active traffic. Press Ctrl+C to stop."
    
    print_option "2" "View Recent Logs (Dashboard)" \
        "Open Cloudflare Dashboard to view recent/historical logs. CLI only supports real-time streaming."
    
    print_option "3" "Real-time Stream (with Instructions)" \
        "Stream logs with helpful instructions. Use Ctrl+C to stop."
    
    print_option "4" "Error Logs Only" \
        "Stream only error responses (4xx and 5xx status codes). Great for finding issues quickly."
    
    print_option "5" "Filter by Status Code" \
        "Filter logs by specific HTTP status codes (e.g., 200, 404, 500). You'll be prompted for codes."
    
    print_option "6" "Filter by HTTP Method" \
        "Filter logs by HTTP method (GET, POST, PUT, DELETE, etc.). You'll be prompted for method."
    
    print_option "7" "Production Environment" \
        "View logs from production environment. Uses --env production flag."
    
    print_option "8" "Production Stream (with Instructions)" \
        "Stream production logs with helpful instructions. Use Ctrl+C to stop."
    
    print_option "9" "Open Cloudflare Dashboard" \
        "Open the Cloudflare Dashboard in your browser for advanced log viewing and filtering."
    
    print_option "0" "Exit" \
        "Exit the script without tailing logs."
    
    echo ""
    print_section "Selection"
    echo -ne "${BOLD}Enter your choice [0-9]: ${NC}"
}

# Execute tail command
execute_tail() {
    local env_flag=$1
    local limit_flag=$2
    local status_filter=$3
    local method_filter=$4
    
    local cmd="wrangler tail"
    
    # Add environment flag if specified
    if [ -n "$env_flag" ]; then
        cmd="$cmd $env_flag"
    fi
    
    # Note: wrangler tail doesn't support --limit flag
    # Limit functionality removed - use dashboard for historical logs
    
    # Add status filter if specified
    if [ -n "$status_filter" ]; then
        cmd="$cmd --status $status_filter"
    fi
    
    # Add method filter if specified
    if [ -n "$method_filter" ]; then
        cmd="$cmd --method $method_filter"
    fi
    
    echo ""
    print_section "Executing Command"
    print_info "Running: ${CYAN}${BOLD}$cmd${NC}"
    echo ""
    print_warning "Press Ctrl+C to stop streaming (if applicable)"
    echo ""
    
    # Execute the command
    eval $cmd
}

# Main script
main() {
    check_wrangler
    check_directory
    
    while true; do
        show_menu
        read -r choice
        echo ""
        
        case $choice in
            1)
                print_section "Real-time Log Streaming"
                print_info "Starting real-time log stream..."
                execute_tail "" "" "" ""
                break
                ;;
            2)
                print_section "View Recent Logs (Dashboard)"
                print_info "Opening Cloudflare Dashboard for historical log viewing..."
                print_warning "Note: wrangler tail only supports real-time streaming, not historical logs."
                
                dashboard_url="https://dash.cloudflare.com"
                
                if command -v xdg-open &> /dev/null; then
                    xdg-open "$dashboard_url" 2>/dev/null
                elif command -v open &> /dev/null; then
                    open "$dashboard_url" 2>/dev/null
                else
                    print_warning "Could not automatically open browser."
                    print_info "Please visit: $dashboard_url"
                fi
                
                echo ""
                print_info "Once in the dashboard:"
                echo "  1. Go to Workers & Pages"
                echo "  2. Click on '$SERVICE_NAME'"
                echo "  3. Click on the 'Logs' tab"
                echo "  4. Use filters to search and view historical logs"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            3)
                print_section "Real-time Stream (with Instructions)"
                print_info "Starting real-time log stream..."
                print_warning "Note: wrangler tail only supports real-time streaming."
                print_info "For historical logs, use the Cloudflare Dashboard (option 2 or 9)."
                echo ""
                print_info "Press Ctrl+C when you want to stop streaming."
                echo ""
                read -p "Press Enter to start streaming..."
                execute_tail "" "" "" ""
                break
                ;;
            4)
                print_section "Error Logs Only"
                print_info "Streaming only error responses (4xx, 5xx)..."
                execute_tail "" "" "error" ""
                break
                ;;
            5)
                print_section "Filter by Status Code"
                echo -ne "${BOLD}Enter status codes (comma-separated, e.g., 200,404,500): ${NC}"
                read -r status_codes
                if [ -n "$status_codes" ]; then
                    print_info "Filtering logs by status codes: $status_codes"
                    execute_tail "" "" "$status_codes" ""
                else
                    print_error "No status codes provided."
                    echo ""
                    read -p "Press Enter to continue..."
                fi
                break
                ;;
            6)
                print_section "Filter by HTTP Method"
                echo -ne "${BOLD}Enter HTTP method (GET, POST, PUT, DELETE, etc.): ${NC}"
                read -r method
                if [ -n "$method" ]; then
                    method=$(echo "$method" | tr '[:lower:]' '[:upper:]')
                    print_info "Filtering logs by method: $method"
                    execute_tail "" "" "" "$method"
                else
                    print_error "No method provided."
                    echo ""
                    read -p "Press Enter to continue..."
                fi
                break
                ;;
            7)
                print_section "Production Real-time Logs"
                print_warning "This will stream logs from PRODUCTION environment"
                echo -ne "${BOLD}Continue? [y/N]: ${NC}"
                read -r confirm
                if [[ "$confirm" =~ ^[Yy]$ ]]; then
                    print_info "Starting real-time log stream from production..."
                    execute_tail "--env production" "" "" ""
                else
                    print_info "Cancelled."
                    echo ""
                    read -p "Press Enter to continue..."
                fi
                break
                ;;
            8)
                print_section "Production Stream (with Instructions)"
                print_warning "This will stream logs from PRODUCTION environment"
                echo -ne "${BOLD}Continue? [y/N]: ${NC}"
                read -r confirm
                if [[ "$confirm" =~ ^[Yy]$ ]]; then
                    print_info "Starting real-time log stream from production..."
                    print_warning "Note: wrangler tail only supports real-time streaming."
                    print_info "For historical logs, use the Cloudflare Dashboard (option 9)."
                    echo ""
                    print_info "Press Ctrl+C when you want to stop streaming."
                    echo ""
                    read -p "Press Enter to start streaming..."
                    execute_tail "--env production" "" "" ""
                else
                    print_info "Cancelled."
                    echo ""
                    read -p "Press Enter to continue..."
                fi
                break
                ;;
            9)
                print_section "Opening Cloudflare Dashboard"
                print_info "Opening browser to Cloudflare Dashboard..."
                
                # Try to open the dashboard URL
                dashboard_url="https://dash.cloudflare.com"
                
                if command -v xdg-open &> /dev/null; then
                    xdg-open "$dashboard_url" 2>/dev/null
                elif command -v open &> /dev/null; then
                    open "$dashboard_url" 2>/dev/null
                elif command -v start &> /dev/null; then
                    start "$dashboard_url" 2>/dev/null
                else
                    print_warning "Could not automatically open browser."
                    print_info "Please visit: $dashboard_url"
                    print_info "Then navigate to: Workers & Pages ❓ $SERVICE_NAME ❓ Logs"
                fi
                
                echo ""
                print_info "Once in the dashboard:"
                echo "  1. Go to Workers & Pages"
                echo "  2. Click on '$SERVICE_NAME'"
                echo "  3. Click on the 'Logs' tab"
                echo "  4. Use filters to search and view historical logs"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            0)
                print_section "Exiting"
                print_info "Goodbye! ❓"
                exit 0
                ;;
            *)
                print_error "Invalid option. Please choose 0-9."
                echo ""
                read -p "Press Enter to continue..."
                ;;
        esac
    done
}

# Run main function
main

