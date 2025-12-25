import type { StorybookConfig } from '@storybook/svelte-vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { mergeConfig } from 'vite';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: [
    '../**/*.stories.@(js|jsx|ts|tsx|svelte)',
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
  staticDirs: [],
  async viteFinal(config) {
    // Set base path from environment variable for Cloudflare deployment
    const basePath = process.env.STORYBOOK_BASE_PATH || '/';
    if (basePath !== '/') {
      config.base = basePath;
    }
    
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@shared-components': resolve(__dirname, '..'),
          '@shared-styles': resolve(__dirname, '../../shared-styles'),
        },
      },
      css: {
        preprocessorOptions: {
          scss: {
            includePaths: [
              resolve(__dirname, '../../shared-styles'),
            ],
          },
        },
      },
    });
  },
};

export default config;

