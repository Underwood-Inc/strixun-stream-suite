# ASCIImoji CDN Deployment

## Overview

The ASCIImoji package is automatically built and deployed to GitHub Pages as a CDN when changes are pushed to the `main` or `master` branch.

## CDN Routes

### GitHub Pages (Primary)

The CDN is deployed to GitHub Pages at:

**Base URL:** `https://{username}.github.io/{repo}/packages/asciimoji/dist/js/`

**Available Files:**
- **Production:** `index.min.js` - Minified IIFE bundle (recommended for production)
- **Development:** `index.js` - Unminified IIFE bundle with source maps
- **ESM:** `index.esm.js` - ESM bundle for modern bundlers
- **Version Info:** `version.json` - Version and build information

### jsDelivr (Alternative)

You can also use jsDelivr CDN:

**Base URL:** `https://cdn.jsdelivr.net/gh/{owner}/{repo}@main/packages/asciimoji/dist/js/`

**Available Files:**
- Production: `index.min.js`
- Development: `index.js`
- ESM: `index.esm.js`

## Usage

### GitHub Pages CDN

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ASCIImoji Example</title>
  <!-- Replace {username} and {repo} with your actual values -->
  <script src="https://{username}.github.io/{repo}/packages/asciimoji/dist/js/index.min.js"></script>
</head>
<body>
  <p>Hello (bear)! How are you? (shrug)</p>
  
  <script>
    AsciimojiTransformer.init({
      selector: 'body',
      observe: true,
      transformOnInit: true
    });
  </script>
</body>
</html>
```

### jsDelivr CDN

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ASCIImoji Example</title>
  <!-- Replace {owner} and {repo} with your actual values -->
  <script src="https://cdn.jsdelivr.net/gh/{owner}/{repo}@main/packages/asciimoji/dist/js/index.min.js"></script>
</head>
<body>
  <p>Hello (bear)! How are you? (shrug)</p>
  
  <script>
    AsciimojiTransformer.init({
      selector: 'body',
      observe: true,
      transformOnInit: true
    });
  </script>
</body>
</html>
```

## Automated Deployment

### GitHub Actions Workflow

The deployment is automated via `.github/workflows/deploy-asciimoji-cdn.yml`.

**Triggers:**
- Push to `main` or `master` branch
- Changes to `packages/asciimoji/**`
- Manual workflow dispatch

**Workflow Steps:**

1. **Test** - Runs unit tests and E2E tests
2. **Build** - Builds the package bundles
3. **Deploy** - Deploys to GitHub Pages

### Build Process

1. Installs dependencies
2. Runs unit tests (`pnpm test`)
3. Runs E2E tests (`pnpm test:e2e`)
4. Builds bundles (`pnpm build`)
5. Creates CDN directory structure
6. Deploys to GitHub Pages

### Test Reports

Test results are automatically uploaded as artifacts:

- **Unit Test Coverage:** Uploaded to Codecov
- **E2E Test Results:** Uploaded as `asciimoji-playwright-report` artifact
- **E2E Screenshots:** Uploaded as `asciimoji-playwright-screenshots` artifact

## Version Information

The `version.json` file contains:

```json
{
  "version": "1.0.0",
  "buildDate": "2025-01-01T12:00:00Z",
  "patterns": 153
}
```

## Verification

After deployment, verify the CDN is working:

1. Check GitHub Pages deployment status
2. Visit the CDN URL in a browser
3. Verify the bundle loads without errors
4. Test transformation in a simple HTML page

## Troubleshooting

### CDN Not Available

1. Check GitHub Pages is enabled in repository settings
2. Verify the workflow completed successfully
3. Check the deployment URL matches your repository structure

### Bundle Not Loading

1. Verify the file path is correct
2. Check browser console for CORS errors
3. Ensure the bundle was built successfully (check workflow logs)

### Tests Failing

1. Check workflow logs for specific test failures
2. Review uploaded test artifacts
3. Run tests locally: `cd packages/asciimoji && pnpm test && pnpm test:e2e`

## Manual Deployment

If you need to deploy manually:

```bash
cd packages/asciimoji
pnpm build
# Then manually upload dist/js/* to your CDN
```

## CDN Best Practices

1. **Use Production Bundle:** Always use `index.min.js` in production
2. **Version Pinning:** Consider pinning to a specific commit/tag for stability
3. **Caching:** CDN files are cached - clear cache after updates
4. **HTTPS:** Always use HTTPS when loading from CDN
5. **Fallback:** Consider a local fallback if CDN fails

## Related Documentation

- [CDN Usage Guide](./CDN_USAGE.md) - How to use the CDN
- [E2E Test Coverage](./E2E_TEST_COVERAGE.md) - Test coverage details
- [README](./README.md) - Package documentation
