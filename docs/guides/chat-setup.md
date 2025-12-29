# 🚀 Chat Client Setup Guide

**Ahoy there!** ❓‍❓❓❓ Here's how to set up and use yer new P2P chat client!

## 📋 Prerequisites

1. ✅ Cloudflare OAuth system set up and working
2. ✅ JWT tokens configured
3. ✅ Cloudflare Workers account
4. ✅ KV namespace access

---

## 🔧 Step 1: Deploy Signaling Server

### 1.1 Create KV Namespace

```bash
cd serverless/chat-signaling
wrangler kv namespace create "CHAT_KV"
```

Copy the returned **namespace ID** and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CHAT_KV"
id = "your-namespace-id-here"
preview_id = "your-namespace-id-here"
```

### 1.2 Set JWT Secret

**IMPORTANT**: The chat signaling server needs the same JWT secret as your main API worker to verify tokens.

#### How to Check if JWT_SECRET is Already Set

1. **Go to your main worker directory:**
   ```bash
   cd serverless
   ```

2. **List all secrets:**
   ```bash
   wrangler secret list
   ```
   
   This will show you all secrets set for that worker. Look for `JWT_SECRET` in the list.

#### Option A: JWT_SECRET Already Exists

If you see `JWT_SECRET` in the list, you need to **retrieve and reuse** the same value:

**⚠️ Problem**: Wrangler doesn't let you view existing secret values (for security). You have two options:

1. **If you remember the value**: Just set it again (same value) for the chat signaling worker:
   ```bash
   cd serverless/chat-signaling
   wrangler secret put JWT_SECRET
   # Enter the SAME value you used before
   ```

2. **If you don't remember**: You'll need to generate a new one and update BOTH workers:
   - Generate new secret (see Option B below)
   - Set it for main worker: `cd serverless && wrangler secret put JWT_SECRET`
   - Set it for chat worker: `cd serverless/chat-signaling && wrangler secret put JWT_SECRET`
   - **Note**: This will invalidate existing tokens, users will need to re-authenticate

#### Option B: JWT_SECRET NOT Set (First Time Setup)

If `JWT_SECRET` is NOT in the list, you need to set it:

1. **Generate a secure secret:**
   ```bash
   # On Linux/Mac:
   openssl rand -base64 32
   
   # On Windows (PowerShell):
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   
   # Or use Node.js:
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Set it for your main worker:**
   ```bash
   cd serverless
   wrangler secret put JWT_SECRET
   # When prompted, paste the generated secret and press Enter
   ```

3. **Set it for the chat signaling worker (SAME VALUE):**
   ```bash
   cd serverless/chat-signaling
   wrangler secret put JWT_SECRET
   # Paste the SAME secret value you used above
   ```

**Why the same secret?** Both workers need to verify JWT tokens signed by the same secret. If they use different secrets, authentication will fail.

#### Option C: Using Default (Testing Only - NOT for Production)

If you haven't set JWT_SECRET, the workers will use a default value (`strixun-stream-suite-default-secret-change-in-production`). 

**This works for testing but is NOT SECURE for production!**

For production, you MUST set a custom secret using Option B above.

### 1.3 Deploy Worker

```bash
wrangler deploy
```

Note the worker URL from the deployment output (e.g., `https://strixun-chat-signaling.strixuns-script-suite.workers.dev`)

### 1.4 Activate Worker Route

**IMPORTANT**: After deployment, you must activate the route in the Cloudflare Dashboard:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) ❓ **Workers & Pages** ❓ **strixun-chat-signaling**
2. Click the **Settings** tab
3. Scroll to **Domains & Routes** section
4. Find the `workers.dev` route (should show as "Inactive")
5. Click the **⋮** (three dots) menu next to the inactive route
6. Select **Activate** or **Enable**

The route should now show as **Active** and be accessible.

**Quick Check**: After activation, test the health endpoint:

**Bash:**
```bash
curl https://strixun-chat-signaling.strixuns-script-suite.workers.dev/health
```

**PowerShell:**
```powershell
(Invoke-WebRequest -Uri https://strixun-chat-signaling.strixuns-script-suite.workers.dev/health).Content
```

You should see: `{"status":"ok","service":"chat-signaling",...}`

---

## 🎨 Step 2: Configure Chat Client

### 2.1 Set Signaling Server URL

Add to your app configuration or environment:

```typescript
// In your config file or environment
export const CHAT_SIGNALING_URL = 'https://strixun-chat-signaling.your-subdomain.workers.dev';
```

Or set globally:

```typescript
// In your main.ts or App.svelte
(window as any).CHAT_SIGNALING_URL = 'https://strixun-chat-signaling.your-subdomain.workers.dev';
```

### 2.2 Import Chat Component

```svelte
<script lang="ts">
  import { ChatClient } from './components/chat';
  import { isAuthenticated } from './stores/auth';
</script>

{#if $isAuthenticated}
  <ChatClient signalingBaseUrl="https://strixun-chat-signaling.your-subdomain.workers.dev" />
{:else}
  <p>Please log in to use chat</p>
{/if}
```

---

## 🎯 Step 3: Usage Examples

### Basic Usage

```svelte
<script lang="ts">
  import { ChatClient } from './components/chat';
</script>

<ChatClient 
  signalingBaseUrl="https://your-signaling-worker.workers.dev"
  showRoomList={true}
  showRoomCreator={true}
/>
```

### Custom Integration

```svelte
<script lang="ts">
  import { RoomManager } from './services/chat/roomManager';
  import { getAuthToken, user } from './stores/auth';
  
  let roomManager: RoomManager;
  
  onMount(() => {
    roomManager = new RoomManager({
      signalingBaseUrl: 'https://your-signaling-worker.workers.dev',
      token: getAuthToken()!,
      userId: user.userId,
      userName: user.email,
      onMessage: (message) => {
        console.log('New message:', message);
      },
      onError: (error) => {
        console.error('Chat error:', error);
      },
    });
  });
  
  async function createRoom() {
    const room = await roomManager.createRoom('My Room');
    console.log('Room created:', room);
  }
  
  async function sendMessage() {
    await roomManager.sendMessage('Hello, world!');
  }
</script>
```

---

## 🔐 Step 4: Authentication

The chat client automatically uses your existing OAuth system:

1. User logs in via email OTP (existing flow)
2. JWT token stored in auth store
3. Chat client reads token from `getAuthToken()`
4. Token sent with all signaling requests

**No additional auth setup needed!** ✅

---

## 🎨 Step 5: Customization

### Styling

All components use CSS variables from your existing theme:

```scss
// Components automatically use:
--card
--background
--text
--text-secondary
--primary
--border
// etc.
```

### Custom Emojis

To add custom emojis, you'll need to implement the emoji API endpoints in your main worker:

```javascript
// In your main worker.js
if (path === '/emoji/list' && request.method === 'GET') {
  // Return custom emojis for domain
}

if (path === '/emoji/upload' && request.method === 'POST') {
  // Handle emoji upload
}
```

---

## 🐛 Troubleshooting

### "Not authenticated" Error

- Ensure user is logged in
- Check JWT token is valid
- Verify token hasn't expired

### "Signaling server URL not configured"

- Set `signalingBaseUrl` prop on `ChatClient`
- Or set `window.CHAT_SIGNALING_URL` globally

### "Failed to create room"

- Check signaling server is deployed
- Verify KV namespace is configured
- Check JWT secret matches between workers

### WebRTC Connection Fails

- Check browser console for WebRTC errors
- Verify STUN servers are accessible
- Some networks block WebRTC (corporate firewalls)

### Messages Not Encrypting

- Verify encryption service is initialized
- Check JWT token is valid
- Ensure `encrypt()` function is working

---

## 📊 Monitoring

### Signaling Server Health

```bash
curl https://your-signaling-worker.workers.dev/health
```

### Check Active Rooms

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-signaling-worker.workers.dev/signaling/rooms
```

---

## 🚀 Next Steps

1. ✅ Deploy signaling server
2. ✅ Configure chat client
3. ✅ Test room creation/joining
4. ✅ Test message sending
5. ✅ Test emote integration
6. ✅ Add custom emoji support (optional)
7. ✅ Customize styling (optional)

---

## 💡 Tips

- **Development**: Use `wrangler dev` for local testing
- **Production**: Set `ENVIRONMENT=production` in worker vars
- **Scaling**: P2P means no server bottleneck - scales with users!
- **Privacy**: Messages never touch server (after initial connection)
- **Cost**: Free tier handles ~100K requests/day

---

**Ye be ready to chat!** ❓❓‍❓❓

