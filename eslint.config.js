import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const ignores = ['dist/**', '**/dist/**', 'node_modules/**', '**/node_modules/**'];

export default [
  {
    ignores,
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  { ...js.configs.recommended, ignores },
  ...tseslint.configs.recommended.map((config) => ({ ...config, ignores })),
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    ignores,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
      'prefer-const': 'off',
    },
  },
];
