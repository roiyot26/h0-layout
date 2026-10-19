import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-*/**', 'node_modules/**', 'e2e/node_modules/**', 'e2e/test-results/**', 'e2e/playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'e2e/**/*.mjs', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
);
