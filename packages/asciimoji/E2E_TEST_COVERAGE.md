# ASCIImoji E2E Test Coverage

## Overview

Comprehensive end-to-end test suite for the ASCIImoji transformer covering both mixin usage (module import) and CDN deployable usage.

## Pattern Count

**Total ASCIImoji Patterns: 153**

The package includes 153 unique ASCIImoji patterns covering:
- Animals (bear, cat, dog, rabbit, etc.)
- Emotions & Expressions (happy, sad, shrug, cool, etc.)
- Actions (run, jump, fight, dance, etc.)
- Objects & Things (table, chair, music, star, etc.)
- Special Characters & Symbols (lenny, kappa, etc.)

## Test Coverage

### Mixin Usage (Module Import) - 8 Tests

1. **Basic Text Transformation**
   - Transforms text nodes with ASCIImoji patterns
   - Verifies patterns are replaced with ASCII art
   - Ensures original patterns are removed

2. **Multiple Patterns in Same Text**
   - Handles multiple patterns in a single text node
   - Verifies all patterns are transformed correctly

3. **Excluded Elements**
   - Does not transform content in excluded elements (script, style, code, pre)
   - Verifies exclusion logic works correctly

4. **Unknown Patterns**
   - Handles unknown patterns gracefully
   - Leaves unknown patterns unchanged

5. **Dynamic Content with MutationObserver**
   - Transforms dynamically added content
   - Verifies MutationObserver integration

6. **Attribute Transformation**
   - Transforms attributes (title, alt, placeholder) when enabled
   - Verifies attribute transformation works

7. **transformText Utility Function**
   - Tests standalone text transformation function
   - Verifies it works without DOM manipulation

8. **Case-Insensitive Matching**
   - Handles case variations (BEAR, Bear, bear)
   - Verifies all variations are transformed

### CDN Usage - 4 Tests

1. **CDN Script Tag Loading**
   - Loads bundle from CDN script tag
   - Initializes using global `AsciimojiTransformer.init()`
   - Verifies transformation works

2. **Global transformAsciimojiText Function**
   - Exposes global `transformAsciimojiText` function
   - Verifies it works independently

3. **Auto-initialization with data-asciimoji-auto**
   - Auto-initializes when `data-asciimoji-auto` attribute is present
   - Verifies automatic setup works

4. **Custom Selector via Data Attribute**
   - Uses custom selector from `data-asciimoji-selector` attribute
   - Verifies selector customization works

### Pattern Coverage - 2 Tests

1. **Common Patterns Transformation**
   - Tests all 15 common test patterns
   - Verifies each pattern transforms correctly

2. **Pattern Count Verification**
   - Verifies total pattern count (153)
   - Ensures pattern registry is complete

### Edge Cases - 3 Tests

1. **Empty Content**
   - Handles empty elements gracefully
   - Does not throw errors

2. **Nested Patterns**
   - Transforms patterns in nested elements
   - Handles complex DOM structures

3. **Rapid DOM Changes**
   - Handles rapid sequential DOM mutations
   - Verifies MutationObserver handles high-frequency changes

## Running Tests

### Prerequisites

1. **Build the package** (for CDN tests):
   ```bash
   cd packages/asciimoji
   pnpm build
   ```

2. **Run E2E tests**:
   ```bash
   # From project root
   pnpm test:e2e packages/asciimoji/asciimoji.e2e.spec.ts
   ```

   Or run all E2E tests:
   ```bash
   pnpm test:e2e
   ```

### Test Structure

Tests are co-located with the package following the project's E2E test structure:
- File: `packages/asciimoji/asciimoji.e2e.spec.ts`
- Uses Playwright for browser automation
- Tests both module import and CDN usage

## Test Scenarios Covered

### ✅ Mixin Usage
- [x] Basic text transformation
- [x] Multiple patterns in same text
- [x] Element exclusion
- [x] Unknown pattern handling
- [x] Dynamic content with MutationObserver
- [x] Attribute transformation
- [x] Utility function usage
- [x] Case-insensitive matching

### ✅ CDN Usage
- [x] Script tag loading
- [x] Global function exposure
- [x] Auto-initialization
- [x] Custom selector via data attributes

### ✅ Pattern Coverage
- [x] Common patterns (15 test patterns)
- [x] Pattern count verification (153 total)

### ✅ Edge Cases
- [x] Empty content
- [x] Nested elements
- [x] Rapid DOM changes

## Build Verification

The CDN bundle is built using esbuild and creates:
- `dist/js/index.js` - Development IIFE bundle
- `dist/js/index.min.js` - Production minified IIFE bundle
- `dist/js/index.esm.js` - ESM bundle for modern bundlers

To verify the build:
```bash
cd packages/asciimoji
pnpm build
ls dist/js/
```

## Notes

- CDN tests are skipped if dist files don't exist (with warning)
- Tests use inline module code for mixin tests (no HTTP server needed)
- All tests verify both transformation and non-transformation cases
- Pattern count is verified to be 153 total patterns
