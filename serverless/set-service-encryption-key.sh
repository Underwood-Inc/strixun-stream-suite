#!/bin/bash
# Bash script to set SERVICE_ENCRYPTION_KEY in all workers
# Usage: ./set-service-encryption-key.sh

echo "🔒 Setting SERVICE_ENCRYPTION_KEY for all workers..."
echo ""

# Prompt for the key (hidden input)
read -sp "Enter SERVICE_ENCRYPTION_KEY (input will be hidden): " key
echo ""

if [ -z "$key" ]; then
    echo "❌ Error: Key cannot be empty"
    exit 1
fi

if [ ${#key} -lt 32 ]; then
    echo "❌ Error: Key must be at least 32 characters"
    exit 1
fi

echo ""
echo "Setting key in all workers..."
echo ""

# List of workers
workers=(
    "otp-auth-service"
    "customer-api"
    "game-api"
    "chat-signaling"
    "mods-api"
    "url-shortener"
    "twitch-api"
)

success_count=0
fail_count=0

for worker in "${workers[@]}"; do
    worker_path="serverless/$worker"
    
    if [ ! -d "$worker_path" ]; then
        echo "⚠️  Skipping $worker (directory not found)"
        continue
    fi
    
    echo "Setting key in $worker..."
    
    # Change to worker directory and set secret
    (
        cd "$worker_path" || exit 1
        echo "$key" | wrangler secret put SERVICE_ENCRYPTION_KEY
        
        if [ $? -eq 0 ]; then
            echo "  ✅ Success"
            ((success_count++))
        else
            echo "  ❌ Failed"
            ((fail_count++))
        fi
    )
done

echo ""
echo "Summary:"
echo "  ✅ Success: $success_count"
echo "  ❌ Failed: $fail_count"
echo ""

if [ $fail_count -eq 0 ]; then
    echo "🎉 All workers configured successfully!"
else
    echo "⚠️  Some workers failed. Please check the errors above."
fi

