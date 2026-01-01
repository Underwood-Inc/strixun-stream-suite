#!/bin/bash
# Bash script to set all encryption keys for frontend and backend
# Usage: ./set-service-encryption-key.sh

echo " ★ Setting all encryption keys for frontend and backend..."
echo ""

# Prompt for SERVICE_ENCRYPTION_KEY (used for OTP encryption)
read -sp "Enter SERVICE_ENCRYPTION_KEY (input will be hidden): " service_encryption_key
echo ""

if [ -z "$service_encryption_key" ]; then
    echo "✗ Error: SERVICE_ENCRYPTION_KEY cannot be empty"
    exit 1
fi

if [ ${#service_encryption_key} -lt 32 ]; then
    echo "✗ Error: SERVICE_ENCRYPTION_KEY must be at least 32 characters"
    exit 1
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
for app_entry in "${frontend_apps@}"; do
    IFS='|' read -r app_path app_name <<< "$app_entry"
    
    if [ ! -d "$app_path" ]; then
        echo "  ⚠ Skipping $app_name (directory not found: $app_path)"
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
        echo "    ✓ $app_name"
        ((success_count++))
    else
        echo "    ✗ Failed to set key in $app_name"
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
for worker in "${workers@}"; do
    worker_path="serverless/$worker"
    
    if [ ! -d "$worker_path" ]; then
        echo "  ⚠ Skipping $worker (directory not found)"
        continue
    fi
    
    echo "  Setting key in $worker..."
    
    # Change to worker directory and set secret
    (
        cd "$worker_path" || exit 1
        echo "$service_encryption_key" | wrangler secret put SERVICE_ENCRYPTION_KEY
        
        if [ $? -eq 0 ]; then
            echo "    ✓ $worker"
            ((success_count++))
        else
            echo "    ✗ Failed to set SERVICE_ENCRYPTION_KEY in $worker"
            ((fail_count++))
        fi
    )
done

echo ""

echo "Summary:"
echo "  ✓ Success: $success_count"
echo "  ✗ Failed: $fail_count"
echo ""

if [ $fail_count -eq 0 ]; then
    echo "✓ All keys configured successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Rebuild frontend apps: cd serverless/url-shortener && pnpm build:app"
    echo "  2. Rebuild mods-hub if needed: cd mods-hub && pnpm build"
    echo "  3. Rebuild OTP dashboard if needed: cd serverless/otp-auth-service/dashboard && pnpm build"
else
    echo "⚠ Some keys failed to set. Please check the errors above."
fi

