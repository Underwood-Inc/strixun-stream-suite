# TypeScript Library Build Standard

**Last Updated:** 2026-01-14  
**Standard Version:** 1.0.0

## Overview

This document defines the standardized architecture for building TypeScript libraries in this monorepo, following industry best practices as of 2026.

## Core Principles

1. **TypeScript Compiler (tsc) is the Standard Tool** - `tsc` is the official TypeScript compiler and is the industry standard for library compilation
2. **Incremental Builds** - All libraries must support incremental compilation for faster rebuilds
3. **Composite Projects** - Libraries in monorepos should use TypeScript project references
4. **Proper Package Exports** - Use modern `package.json` exports field with proper type declarations
5. **Source Maps & Declaration Maps** - Enable debugging and IDE navigation

## Standard tsconfig.json Configuration

### Required Compiler Options

```json
{
  "compilerOptions": {
    // Target modern JavaScript
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    
    // Module Resolution
    "moduleResolution": "bundler", // For modern bundlers (Vite, esbuild)
    "resolveJsonModule": true,
    
    // Type Safety
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    
    // Performance
    "skipLibCheck": true, // Skip checking .d.ts files from node_modules
    "isolatedModules": true, // Each file can be transpiled independently
    
    // Interoperability
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    
    // Output Configuration
    "declaration": true, // Generate .d.ts files
    "declarationMap": true, // Generate .d.ts.map for IDE navigation
    "sourceMap": true, // Generate .js.map for debugging
    "outDir": "./dist",
    "rootDir": ".",
    
    // Incremental Builds (for monorepos)
    "incremental": true,
    "composite": true, // Required for project references
    
    // Type Definitions
    "types": ["node"] // Adjust based on library needs
  }
}
```

### File Inclusion/Exclusion

```json
{
  "include": [
    "**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/*.config.ts",
    "coverage"
  ]
}
```

## Standard package.json Configuration

### Build Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  }
}
```

### Package Exports

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./subpath": {
      "types": "./dist/subpath.d.ts",
      "default": "./dist/subpath.js"
    }
  },
  "files": [
    "dist/**/*.js",
    "dist/**/*.d.ts",
    "dist/**/*.d.ts.map",
    "*.md"
  ]
}
```

## Build Command Standards

### Standard Library Build

For libraries in `packages/`:

```bash
tsc
```

This uses the `tsconfig.json` in the package root.

### Subdirectory Build (e.g., shared/)

For TypeScript code in subdirectories (like `serverless/otp-auth-service/shared/`):

```bash
tsc -p shared/tsconfig.json
```

**NOT** `cd shared && tsc` - this is less explicit and harder to debug.

## Project References (Monorepo)

For libraries that depend on other libraries in the monorepo:

### Root tsconfig.json

```json
{
  "files": [],
  "references": [
    { "path": "./packages/auth-store" },
    { "path": "./packages/api-framework" },
    { "path": "./packages/types" }
  ]
}
```

### Library tsconfig.json

```json
{
  "compilerOptions": {
    "composite": true,
    // ... other options
  },
  "references": [
    { "path": "../types" },
    { "path": "../api-framework" }
  ]
}
```

## Output Structure

All libraries must output to:

```
dist/
├── index.js              # Compiled JavaScript
├── index.d.ts            # Type declarations
├── index.d.ts.map        # Declaration source map
├── index.js.map          # Source map
└── [other files...]
```

## Verification Checklist

- [ ] `tsconfig.json` has `composite: true` (if using project references)
- [ ] `tsconfig.json` has `incremental: true`
- [ ] `tsconfig.json` has `declaration: true` and `declarationMap: true`
- [ ] `tsconfig.json` has `sourceMap: true`
- [ ] `package.json` has `build` script using `tsc`
- [ ] `package.json` exports point to `dist/**/*.js` and `dist/**/*.d.ts`
- [ ] `package.json` `files` field includes `dist/**/*.js`, `dist/**/*.d.ts`, `dist/**/*.d.ts.map`
- [ ] Build outputs to `dist/` directory
- [ ] No `.js` extensions in TypeScript imports (TypeScript handles module resolution)

## Migration Guide

### From `cd dir && tsc` to Standard

**Before (Non-Standard):**
```json
{
  "scripts": {
    "build:shared": "cd shared && tsc"
  }
}
```

**After (Standard):**
```json
{
  "scripts": {
    "build:shared": "tsc -p shared/tsconfig.json"
  }
}
```

### Benefits

1. **Explicit** - Clearly shows which config file is used
2. **Debuggable** - Easier to troubleshoot build issues
3. **IDE-Friendly** - IDEs can better understand the build structure
4. **CI/CD Friendly** - Works better in automated environments
5. **Cross-Platform** - Works consistently on Windows, macOS, Linux

## References

- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig)
- [Package.json Exports Field](https://nodejs.org/api/packages.html#exports)
- [TypeScript Performance Best Practices](https://github.com/microsoft/TypeScript/wiki/Performance)
