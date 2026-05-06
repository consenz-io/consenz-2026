module.exports = {
  env: {
    browser: true,
    es2020: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
      env: {
        'vitest-globals/env': true,
      },
      plugins: ['vitest-globals'],
    },
  ],
};