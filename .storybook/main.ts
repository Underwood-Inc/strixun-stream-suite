import type { StorybookConfig } from '@storybook/svelte-vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { mergeConfig } from 'vite';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: [
    '../src/lib/**/*.stories.@(js|jsx|ts|tsx|svelte)',
  ],
  addons: [
    '@storybook/addon-svelte-csf',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/svelte-vite',
    options: {
      svelteOptions: {
        onwarn: (warning: any, handler: any) => {
          // Suppress CSS unused selector warnings (classes may be used dynamically or in imported SCSS)
          if (warning.code === 'css-unused-selector') return;
          // Suppress a11y warnings during migration
          if (warning.code?.startsWith('a11y-')) return;
          handler(warning);
        },
      },
    },
  },
  docs: {
    autodocs: 'tag',
  },
  // Base path for GitHub Pages deployment (subdirectory)
  // Set via STORYBOOK_BASE_PATH env var, defaults to '/' for local development
  staticDirs: [],
  // Theme configuration - using CSS overrides in manager-head.html instead
  async viteFinal(config) {
    // Set base path from environment variable for GitHub Pages deployment
    const basePath = process.env.STORYBOOK_BASE_PATH || '/';
    if (basePath !== '/') {
      config.base = basePath;
    }
    
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@': resolve(__dirname, '../src'),
          '@components': resolve(__dirname, '../src/lib/components'),
          '@modules': resolve(__dirname, '../src/modules'),
          '@stores': resolve(__dirname, '../src/stores'),
          '@styles': resolve(__dirname, '../src/styles'),
        },
      },
      css: {
        preprocessorOptions: {
          scss: {
            // SCSS configuration - variables are imported in each file
          },
        },
      },
    });
  },
};

export default config;
