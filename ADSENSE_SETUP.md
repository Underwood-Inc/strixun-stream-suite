# Google AdSense Setup

## ads.txt Files

Each frontend app has an `ads.txt` file in its `public/` folder:

- `mods-hub/public/ads.txt`
- `chat-hub/public/ads.txt`
- `access-hub/public/ads.txt`
- `control-panel/public/ads.txt`
- `dice-board-game/public/ads.txt`
- `serverless/otp-auth-service/public/ads.txt` (dashboard)
- `serverless/url-shortener/app/public/ads.txt`

**Content:**
```
google.com, pub-3757286003859686, DIRECT, f08c47fec0942fa0
```

## How It Works

### Standard Vite Apps (mods-hub, chat-hub, access-hub, control-panel, dice-board-game)
1. **Build:** Vite automatically copies `public/` folder contents to build root
2. **Deploy:** File is served at `https://subdomain.yourdomain.com/ads.txt`

### Embedded Apps (otp-auth-service, url-shortener)
1. **Build:** Vite copies `public/` to dist, then build script embeds dist files into worker
2. **Deploy:** Worker serves embedded ads.txt at `https://subdomain.yourdomain.com/ads.txt`

### Verification
3. **Verify:** Google crawls the file (takes 24-48 hours)

## Verification

After deployment, check each subdomain:
```bash
curl https://mods.yourdomain.com/ads.txt
curl https://chat.yourdomain.com/ads.txt
curl https://auth.yourdomain.com/ads.txt
curl https://links.yourdomain.com/ads.txt
# etc.
```

That's it. No server-side code needed - Vite handles copying, build scripts handle embedding.
