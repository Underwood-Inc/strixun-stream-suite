import type { StorybookConfig } from '@storybook/svelte-vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
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
        // Disable docgen for story files - they cause parse errors
        // Storybook has its own documentation system
        docgen: false,
      },
    } as any,
  },
  docs: {
    autodocs: 'tag',
  } as any,
  staticDirs: [],
  async viteFinal(config) {
    // Set base path from environment variable for Cloudflare deployment
    const basePath = process.env.STORYBOOK_BASE_PATH || '/';
    if (basePath !== '/') {
      config.base = basePath;
    }
    
    // Configure plugin order: Svelte plugin must run before addon-svelte-csf
    // The addon-svelte-csf plugin needs files to be processed by Svelte first
    if (config.plugins) {
      // Remove docgen plugin - it causes parse errors with story files
      config.plugins = config.plugins.filter((plugin: any) => {
        const name = plugin?.name || plugin?.constructor?.name || '';
        return !name.includes('svelte-docgen');
      });
      
      // Find plugin indices
      const sveltePluginIndex = config.plugins.findIndex((p: any) => {
        const name = p?.name || '';
        return name === 'vite-plugin-svelte' || (name.includes('svelte') && !name.includes('docgen') && !name.includes('csf'));
      });
      
      const csfPluginIndex = config.plugins.findIndex((p: any) => {
        const name = p?.name || p?.constructor?.name || '';
        return name.includes('svelte-csf') || name.includes('addon-svelte-csf');
      });
      
      // Ensure Svelte plugin runs before addon-svelte-csf
      if (sveltePluginIndex >= 0 && csfPluginIndex >= 0 && sveltePluginIndex > csfPluginIndex) {
        // Move Svelte plugin before CSF plugin
        const sveltePlugin = config.plugins[sveltePluginIndex];
        config.plugins.splice(sveltePluginIndex, 1);
        config.plugins.splice(csfPluginIndex, 0, sveltePlugin);
      } else if (sveltePluginIndex >= 0 && sveltePluginIndex > 0) {
        // Move Svelte plugin to the front if CSF plugin not found
        const sveltePlugin = config.plugins[sveltePluginIndex];
        config.plugins.splice(sveltePluginIndex, 1);
        config.plugins.unshift(sveltePlugin);
      }
      
      // Configure addon-svelte-csf to skip raw Svelte files (wait for Svelte plugin to process them)
      if (csfPluginIndex >= 0) {
        const csfPlugin = config.plugins[csfPluginIndex] as any;
        if (csfPlugin) {
          // Set enforce to 'post' so it runs after Svelte plugin
          if (!csfPlugin.enforce) {
            csfPlugin.enforce = 'post';
          }
          
          // Override transform to skip unprocessed Svelte files
          // Must preserve 'this' context for plugin to work correctly
          if (csfPlugin.transform) {
            const originalTransform = csfPlugin.transform;
            csfPlugin.transform = function(code: string, id: string, options?: any) {
              // Skip if file contains raw Svelte syntax (hasn't been processed yet)
              if (id.includes('.stories.svelte') && code.includes('<script module>')) {
                // Check if it's still raw Svelte (not processed)
                if (!code.includes('import.meta.hot') && code.trim().startsWith('<script')) {
                  return null; // Skip - let Svelte plugin handle it first
                }
              }
              // Call original with correct 'this' context
              return originalTransform.call(this, code, id, options);
            };
          }
        }
      }
      
      // Ensure Svelte plugin has 'pre' enforce to run first and handles .stories.svelte files
      if (sveltePluginIndex >= 0) {
        const sveltePlugin = config.plugins[sveltePluginIndex] as any;
        if (sveltePlugin) {
          // Set enforce to 'pre' so it runs before Rollup tries to parse
          if (!sveltePlugin.enforce) {
            sveltePlugin.enforce = 'pre';
          }
          
          // Ensure the plugin handles .stories.svelte files
          const originalResolveId = sveltePlugin.resolveId;
          if (originalResolveId) {
            sveltePlugin.resolveId = function(source: string, importer: string, options: any) {
              if (source.includes('.stories.svelte')) {
                return originalResolveId.call(this, source, importer, options);
              }
              return originalResolveId.call(this, source, importer, options);
            };
          }
          
          // Override load to ensure .stories.svelte files are handled
          const originalLoad = sveltePlugin.load;
          if (originalLoad) {
            sveltePlugin.load = function(id: string) {
              if (id.includes('.stories.svelte')) {
                return originalLoad.call(this, id);
              }
              return originalLoad.call(this, id);
            };
          }
        }
      }
      
      // If Svelte plugin not found, add it explicitly to handle .stories.svelte files
      if (sveltePluginIndex < 0) {
        config.plugins.unshift(svelte({
          onwarn: (warning: any, handler: any) => {
            if (warning.code === 'css-unused-selector') return;
            if (warning.code?.startsWith('a11y-')) return;
            handler(warning);
          },
        }));
      }
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
          '@storybook/svelte-vite',
          '@storybook/addon-svelte-csf',
          'svelte',
        ],
        // Exclude @storybook/svelte from optimization - it contains .svelte files
        // that esbuild can't process. The Svelte plugin will handle them at runtime.
        exclude: [
          '@storybook/svelte',
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

