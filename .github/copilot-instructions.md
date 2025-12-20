# GitHub Copilot Instructions - Strixun Stream Suite

## Project Context
OBS Studio plugin suite with Lua scripts and HTML/CSS/JS control panels for stream automation.

## Tech Stack
- Lua 5.1 with obslua bindings (OBS scripting API)
- Vanilla HTML5/CSS3/JavaScript (no frameworks)
- IndexedDB + localStorage for persistence
- OBS WebSocket for communication

## Key Rules

### Must Follow
- Use vanilla JS only - no frameworks or build tools
- Use the `storage` object for persistence (dual IndexedDB/localStorage system)
- Prefix storage keys with `sss_`
- Use CSS custom properties from `:root` for styling
- Use conventional commit messages
- Keep files under 300 lines

### Must Avoid
- `!important` in CSS - use proper specificity
- Inline styles/scripts in HTML
- ES modules - use traditional script tags
- npm commands - use pnpm
- Creating fallback code unless requested
- Running dev/build commands without permission

### Lua Specifics
- Always use `local` keyword
- Check for nil before property access
- Use `pcall` for potentially failing operations
- Use OBS API functions from `obslua` module

### JavaScript Specifics
- Async/await for async operations
- Always handle WebSocket connection states
- Use existing helper functions before creating new ones

## Storage Pattern
```javascript
// Always use the storage wrapper
storage.set('myKey', value);      // Writes to IDB + localStorage + cache
const val = storage.get('myKey'); // Reads from cache (sync)
```

## File Organization
- `*.lua` - OBS scripts
- `*.html` - Browser docks/sources
- `assets/css/` - Stylesheets
- `assets/js/` - JavaScript modules

