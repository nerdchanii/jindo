import eslint from '@eslint/js';

export default [
  {
    ignores: ['dist/', 'node_modules/', '.git-trees/', '**/*.test.ts'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'prefer-const': 'error',
    },
  },
];
