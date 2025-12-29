# Local Testing Guide 🧪

## Quick Start

1. **Navigate to the service directory:**
   ```bash
   cd serverless/otp-auth-service
   ```

2. **Start the local development server:**
   ```bash
   wrangler dev
   ```

   This will start the worker on `http://localhost:8787` (or another port if 8787 is busy)

3. **Test the endpoints:**
   - **Landing Page**: `http://localhost:8787/`
   - **OpenAPI Spec**: `http://localhost:8787/openapi.json`
   - **Swagger UI**: Open landing page ❓ Scroll to "API Endpoints" ❓ Expand accordion ❓ Swagger UI loads below

## What to Test

### ✅ Landing Page
- Open `http://localhost:8787/` in your browser
- Check that the page loads with all sections
- Test the self-hosting section you just added
- Verify all accordions expand/collapse correctly

### ✅ OpenAPI Spec
- Visit `http://localhost:8787/openapi.json`
- Should return valid JSON with all API endpoints
- Check that all endpoints are documented

### ✅ Swagger UI
- On the landing page, scroll to "Technical Documentation"
- Click "API Endpoints" accordion to expand
- Swagger UI should load below showing all endpoints
- Try clicking "Try it out" on any endpoint to test

### ✅ API Endpoints (if you have secrets configured)
If you have JWT_SECRET and RESEND_API_KEY configured:
- Test `/auth/request-otp` with a real email
- Test `/auth/verify-otp` with the OTP code
- Test `/auth/me` with the returned JWT token

## Troubleshooting

### Swagger UI Not Loading?
- Check browser console for errors
- Make sure the scripts are loading (check Network tab)
- The Swagger UI initializes when you expand the "API Endpoints" accordion

### OpenAPI Spec Not Found?
- Check that `openapi-json.js` exists in the directory
- Verify the import in `worker.js` is correct
- Check browser console for import errors

### Landing Page Not Loading?
- Check that `landing-html.js` exists
- Verify the import in `worker.js` is correct
- Make sure you're running `wrangler dev` from the correct directory

## Required Files Checklist

Before testing, ensure these files exist:
- ✅ `worker.js` - Main worker file
- ✅ `landing-html.js` - Embedded landing page
- ✅ `openapi-json.js` - Embedded OpenAPI spec
- ✅ `wrangler.toml` - Worker configuration

## Next Steps After Testing

1. **Build Dashboard** (when ready):
   ```bash
   cd dashboard
   pnpm install
   pnpm build
   ```

2. **Deploy to Production**:
   ```bash
   wrangler deploy
   ```

## Notes

- The dashboard is not built yet, so `/dashboard` will show a placeholder
- Swagger UI loads from CDN, so you need internet connection
- All API endpoints require proper secrets to work fully

