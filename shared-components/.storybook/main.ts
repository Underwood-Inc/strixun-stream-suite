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
    
    // Resolve root node_modules for workspace dependencies
    const rootDir = resolve(__dirname, '../..');
    const rootNodeModules = resolve(rootDir, 'node_modules');
    
    // Ensure server.fs.allow exists
    if (!config.server) {
      config.server = {};
    }
    if (!config.server.fs) {
      config.server.fs = {};
    }
    if (!config.server.fs.allow) {
      config.server.fs.allow = [];
    }
    
    // Allow access to root workspace and node_modules
    config.server.fs.allow.push(
      rootDir,
      rootNodeModules,
      resolve(__dirname, '..'),
    );
    
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@shared-components': resolve(__dirname, '..'),
          '@shared-styles': resolve(__dirname, '../../shared-styles'),
        },
        // Ensure Vite can find dependencies in workspace root
        dedupe: ['svelte', '@storybook/svelte'],
      },
      // Add root node_modules to resolve paths
      optimizeDeps: {
        include: [
          '@storybook/svelte',
          '@storybook/svelte-vite',
          '@storybook/addon-svelte-csf',
          'svelte',
        ],
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

