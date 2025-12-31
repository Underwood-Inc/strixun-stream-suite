#!/bin/bash
# Bash script to set all encryption keys for frontend and backend
# Usage: ./set-service-encryption-key.sh

echo "[EMOJI] Setting all encryption keys for frontend and backend..."
echo ""

# Prompt for SERVICE_ENCRYPTION_KEY (used for OTP encryption)
read -sp "Enter SERVICE_ENCRYPTION_KEY (input will be hidden): " service_encryption_key
echo ""

if [ -z "$service_encryption_key" ]; then
    echo "[ERROR] Error: SERVICE_ENCRYPTION_KEY cannot be empty"
    exit 1
fi

if [ ${#service_encryption_key} -lt 32 ]; then
    echo "[ERROR] Error: SERVICE_ENCRYPTION_KEY must be at least 32 characters"
    exit 1
fi

# Prompt for SERVICE_API_KEY (used for service-to-service auth)
echo ""
echo "Enter SERVICE_API_KEY for service-to-service authentication (customer-api calls)"
read -sp "Enter SERVICE_API_KEY (input will be hidden): " service_api_key
echo ""

if [ -z "$service_api_key" ]; then
    echo "[WARNING] SERVICE_API_KEY is empty. Customer API calls will fail with 401."
    echo "Do you want to continue without SERVICE_API_KEY? (y/n)"
    read -r continue_choice
    if [ "$continue_choice" != "y" ] && [ "$continue_choice" != "Y" ]; then
        exit 1
    fi
fi

echo ""
echo "Setting keys..."
echo ""

success_count=0
fail_count=0

# List of frontend apps that need VITE_SERVICE_ENCRYPTION_KEY
declare -a frontend_apps=(
    ".|Root"
    "mods-hub|Mods Hub"
    "serverless/url-shortener/app|URL Shortener App"
    "serverless/otp-auth-service/dashboard|OTP Auth Dashboard"
)

# Set VITE_SERVICE_ENCRYPTION_KEY in frontend .env files
echo "Setting VITE_SERVICE_ENCRYPTION_KEY in frontend .env files..."
for app_entry in "${frontend_apps[@]}"; do
    IFS='|' read -r app_path app_name <<< "$app_entry"
    
    if [ ! -d "$app_path" ]; then
        echo "  [WARNING] Skipping $app_name (directory not found: $app_path)"
        continue
    fi
    
    env_file="$app_path/.env"
    echo "  Setting key in $app_name..."
    
    # Create .env file if it doesn't exist
    if [ ! -f "$env_file" ]; then
        touch "$env_file"
    fi
    
    # Update or add VITE_SERVICE_ENCRYPTION_KEY
    if grep -q "^VITE_SERVICE_ENCRYPTION_KEY=" "$env_file"; then
        # Update existing key
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^VITE_SERVICE_ENCRYPTION_KEY=.*|VITE_SERVICE_ENCRYPTION_KEY=$service_encryption_key|" "$env_file"
        else
            # Linux
            sed -i "s|^VITE_SERVICE_ENCRYPTION_KEY=.*|VITE_SERVICE_ENCRYPTION_KEY=$service_encryption_key|" "$env_file"
        fi
    else
        # Add new key
        echo "VITE_SERVICE_ENCRYPTION_KEY=$service_encryption_key" >> "$env_file"
    fi
    
    if [ $? -eq 0 ]; then
        echo "    [OK] $app_name"
        ((success_count++))
    else
        echo "    [ERROR] Failed to set key in $app_name"
        ((fail_count++))
    fi
done

echo ""

# List of workers that need SERVICE_ENCRYPTION_KEY
workers=(
    "otp-auth-service"
    "customer-api"
    "game-api"
    "chat-signaling"
    "mods-api"
    "url-shortener"
    "twitch-api"
)

# Set SERVICE_ENCRYPTION_KEY in workers
echo "Setting SERVICE_ENCRYPTION_KEY in workers..."
for worker in "${workers[@]}"; do
    worker_path="serverless/$worker"
    
    if [ ! -d "$worker_path" ]; then
        echo "  [WARNING] Skipping $worker (directory not found)"
        continue
    fi
    
    echo "  Setting key in $worker..."
    
    # Change to worker directory and set secret
    (
        cd "$worker_path" || exit 1
        echo "$service_encryption_key" | wrangler secret put SERVICE_ENCRYPTION_KEY
        
        if [ $? -eq 0 ]; then
            echo "    [OK] $worker"
            ((success_count++))
        else
            echo "    [ERROR] Failed to set SERVICE_ENCRYPTION_KEY in $worker"
            ((fail_count++))
        fi
    )
done

echo ""

# Set SERVICE_API_KEY in workers that need it
if [ -n "$service_api_key" ]; then
    echo "Setting SERVICE_API_KEY in workers..."
    service_workers=(
        "otp-auth-service"
        "customer-api"
    )
    
    for worker in "${service_workers[@]}"; do
        worker_path="serverless/$worker"
        
        if [ ! -d "$worker_path" ]; then
            echo "  [WARNING] Skipping $worker (directory not found)"
            continue
        fi
        
        echo "  Setting SERVICE_API_KEY in $worker..."
        
        # Change to worker directory and set secret
        (
            cd "$worker_path" || exit 1
            echo "$service_api_key" | wrangler secret put SERVICE_API_KEY
            
            if [ $? -eq 0 ]; then
                echo "    [OK] $worker"
                ((success_count++))
            else
                echo "    [ERROR] Failed to set SERVICE_API_KEY in $worker"
                ((fail_count++))
            fi
        )
    done
    echo ""
fi

echo "Summary:"
echo "  [OK] Success: $success_count"
echo "  [ERROR] Failed: $fail_count"
echo ""

if [ $fail_count -eq 0 ]; then
    echo "[OK] All keys configured successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Rebuild frontend apps: cd serverless/url-shortener && pnpm build:app"
    echo "  2. Rebuild mods-hub if needed: cd mods-hub && pnpm build"
    echo "  3. Rebuild OTP dashboard if needed: cd serverless/otp-auth-service/dashboard && pnpm build"
else
    echo "[WARNING] Some keys failed to set. Please check the errors above."
fi

