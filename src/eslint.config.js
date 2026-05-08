import js from '@eslint/js';

export default [
  {
    ignores: ['**/__tests__/**', '**/*.test.js', '**/*.test.jsx', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.js', '**/*.spec.jsx'],
  },
  js.configs.recommended,
];