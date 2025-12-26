# ActivityLog Component Tests

Real integration tests for the ActivityLog component that test actual functionality without mocks.

## Setup

Install the testing dependencies:

```bash
pnpm install
```

This will install:
- `@testing-library/svelte` - Svelte component testing
- `@testing-library/jest-dom` - DOM matchers
- `@testing-library/user-event` - User interaction simulation
- `jsdom` - DOM environment for tests

## Running Tests

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui
```

## What These Tests Do

These tests verify:

1. **Component renders correctly** - ActivityLog displays when mounted
2. **Store integration** - Logs added to the store appear in the component
3. **Reactivity** - Component updates when logs are added after mount
4. **Log types** - All log types (info, success, error, warning) display correctly
5. **Flairs** - Custom flairs/badges display correctly
6. **Empty state** - Shows "No log entries yet" when empty
7. **Clear functionality** - Clearing logs updates the component
8. **Duplicate merging** - Duplicate consecutive messages are merged
9. **window.addLogEntry integration** - Works when called via window.addLogEntry
10. **Store limits** - Respects MAX_ENTRIES (1000) limit

## No Mocks

These tests use the **REAL** store and component - no mocks, no fake data. They test the actual integration between:
- `addLogEntry()` function
- `logEntries` store
- `ActivityLog` component
- `window.addLogEntry` global function

If these tests pass, the logger is working correctly.

