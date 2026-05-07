module.exports = {
  overrides: [
    {
      files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}', '**/*.spec.{js,jsx}'],
      env: {
        'vitest-globals/env': true,
      },
      plugins: ['vitest-globals'],
    },
  ],
};