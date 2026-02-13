import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // React Three Fiber (R3F) components — R3F extends JSX with custom
  // Three.js element props (position, args, geometry, etc.) that
  // eslint-plugin-react cannot recognise.  TS suppression directives
  // (@ts-nocheck / @ts-ignore) are common here because R3F's JSX
  // typings diverge from standard React DOM elements.
  {
    files: ['react/**/*.{ts,tsx}'],
    rules: {
      'react/no-unknown-property': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  // Type declaration stubs commonly require `any` for broad compatibility.
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
