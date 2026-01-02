# Control Panel - OBS Studio Dock

React-based single-file bundle control panel for OBS Studio, optimized for dock integration.

## Overview

This is a standalone React control panel that bundles into a single HTML file using `vite-plugin-singlefile`. It's designed to be embedded as a Custom Browser Dock in OBS Studio.

## Features

- **Single-File Bundle** - Everything bundled into one HTML file for easy OBS integration
- **React 19** - Modern React with TypeScript
- **Styled Components** - Component-based styling
- **OBS WebSocket Integration** - Connects to OBS Studio via WebSocket

## Development

### Prerequisites

- Node.js 18+
- pnpm 9+

### Setup

```bash
cd control-panel
pnpm install
```

### Development Server

```bash
pnpm dev
```

The dev server runs on `http://localhost:5175`

### Build

```bash
pnpm build
```

Outputs to `../dist/control-panel/` as a single HTML file.

### Preview

```bash
pnpm preview
```

## Project Structure

```
control-panel/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── theme/          # Theme configuration
│   └── types/          # TypeScript types
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Integration with OBS Studio

1. Build the project: `pnpm build`
2. In OBS Studio, go to **View > Docks > Custom Browser Docks**
3. Add a new dock and point it to the built HTML file
4. The control panel will connect to OBS via WebSocket (default port 4455)

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **vite-plugin-singlefile** - Single-file bundling
- **styled-components** - Styling

## License

Private - Part of Strixun Stream Suite
