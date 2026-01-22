# Google AdSense Setup

## Verification Method: Meta Tag

Each frontend app has the Google AdSense verification meta tag in its `index.html`:

```html
<meta name="google-adsense-account" content="ca-pub-3757286003859686">
```

## Files Updated

- `mods-hub/index.html`
- `chat-hub/index.html`
- `access-hub/index.html`
- `control-panel/index.html`
- `serverless/otp-auth-service/index.html` (dashboard)
- `serverless/url-shortener/app/index.html`

## ads.txt Files (Backup Method)

Each app also has an `ads.txt` file in its `public/` folder as a backup:

- `mods-hub/public/ads.txt`
- `chat-hub/public/ads.txt`
- `access-hub/public/ads.txt`
- `control-panel/public/ads.txt`
- `dice-board-game/public/ads.txt`
- `serverless/otp-auth-service/public/ads.txt`
- `serverless/url-shortener/app/public/ads.txt`

**Content:**
```
google.com, pub-3757286003859686, DIRECT, f08c47fec0942fa0
```

## How It Works

1. **Meta Tag:** Google AdSense crawls the HTML and finds the verification meta tag in `<head>`
2. **ads.txt:** Served at root path (`/ads.txt`) for publisher verification
3. **Deploy:** Both methods work automatically after deployment

## Verification Steps

1. Deploy your apps with the updated `index.html` files
2. Visit Google AdSense verification page
3. Select "Meta tag" method
4. Click "Verify" - Google will crawl your site and find the meta tag
5. Wait for verification (usually instant, but can take up to 24 hours)
