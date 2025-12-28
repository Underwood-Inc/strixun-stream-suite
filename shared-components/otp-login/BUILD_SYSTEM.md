# OTP Login Library - Build System

## Overview

The OTP Login library is a **properly structured library** that provides login components for multiple frameworks. All projects must use the **built dist files** from this library, not the source files directly.

## Architecture

### Single Source of Truth

- **One component per component type**: Login, Login Error, Login Inputs, Login Modal
- **Framework-specific wrappers**: React, Svelte, and Vanilla JS
- **Shared core logic**: All frameworks use the same `OtpLoginCore` class

### Build Outputs

The library builds to `dist/` with the following structure:

```
dist/
├── react/
│   ├── otp-login.js      # ES Module
│   ├── otp-login.cjs     # CommonJS
│   └── index.js          # Entry point
├── svelte/
│   ├── otp-login.js      # ES Module
│   └── index.js          # Entry point
└── js/
    ├── otp-login-core.js         # IIFE (Development)
    ├── otp-login-core.min.js     # IIFE (Production)
    ├── otp-login-core.esm.js     # ES Module
    └── index.js                  # Entry point
```

## Building the Library

### Build All Frameworks

```bash
cd shared-components/otp-login
pnpm build
```

This builds:
- Vanilla JS core
- React components
- Svelte components

### Build Individual Frameworks

```bash
# Build React only
pnpm build:react

# Build Svelte only
pnpm build:svelte

# Build Vanilla JS only
pnpm build:vanilla
```

## Using the Library in Projects

### React Projects (mods-hub, control-panel)

**Import from dist:**
```typescript
import { OtpLogin } from '../../../shared-components/otp-login/dist/react';
import type { LoginSuccessData } from '../../../shared-components/otp-login/dist/react';
```

**Build Script:**
Projects automatically build the OTP library before their own builds via `prebuild` script:

```json
{
  "scripts": {
    "prebuild": "cd ../../shared-components/otp-login && pnpm build:react",
    "build": "tsc -b && vite build"
  }
}
```

### Svelte Projects (main app, dashboard)

**Import from dist:**
```svelte
<script>
  import OtpLogin from '../../../../shared-components/otp-login/dist/svelte';
  import type { LoginSuccessData } from '../../../../shared-components/otp-login/dist/svelte';
</script>
```

**Build Script:**
```json
{
  "scripts": {
    "prebuild": "cd shared-components/otp-login && pnpm build:svelte",
    "build": "vite build"
  }
}
```

### Vanilla JS Projects

**Import from dist:**
```javascript
import { OtpLoginCore } from './shared-components/otp-login/dist/js';
```

Or use the IIFE version:
```html
<script src="./shared-components/otp-login/dist/js/otp-login-core.js"></script>
<script>
  const login = new window.OtpLoginCore({ ... });
</script>
```

## Critical Rules

### ❌ NEVER Import from Source

**WRONG:**
```typescript
// ❌ DON'T DO THIS
import { OtpLogin } from '../../../shared-components/otp-login/react/OtpLogin';
import OtpLogin from '../../../shared-components/otp-login/svelte/OtpLogin.svelte';
```

**CORRECT:**
```typescript
// ✅ DO THIS
import { OtpLogin } from '../../../shared-components/otp-login/dist/react';
import OtpLogin from '../../../shared-components/otp-login/dist/svelte';
```

### ✅ Always Build Before Using

Projects must build the OTP library before their own builds. This ensures:
1. Latest changes are included
2. Proper bundling and optimization
3. Consistent behavior across all projects

### ✅ Single Source of Truth

- **One component** for login forms
- **One component** for error displays
- **One component** for input fields
- **One component** for modals

All projects use the same built components, ensuring consistency.

## Development Workflow

1. **Make changes** to source files in `shared-components/otp-login/`
2. **Build the library**: `cd shared-components/otp-login && pnpm build`
3. **Projects automatically rebuild** the library before their builds via `prebuild` scripts
4. **Import from dist** in all projects

## Troubleshooting

### Build Fails

If a project build fails, ensure:
1. OTP library is built: `cd shared-components/otp-login && pnpm build`
2. Dependencies are installed: `pnpm install`
3. Paths are correct in imports

### Import Errors

If imports fail:
1. Verify you're importing from `dist/` not source
2. Check the framework-specific dist folder exists
3. Ensure the library was built for that framework

### Inconsistent Behavior

If login forms behave differently:
1. Ensure all projects use `dist/` imports
2. Rebuild the library: `cd shared-components/otp-login && pnpm build`
3. Rebuild all projects

## Migration Checklist

When migrating a project to use dist files:

- [ ] Update imports to use `dist/react` or `dist/svelte`
- [ ] Add `prebuild` script to build OTP library
- [ ] Remove direct source file imports
- [ ] Test login flow works correctly
- [ ] Verify build process works

