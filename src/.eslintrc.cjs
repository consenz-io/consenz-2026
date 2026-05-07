module.exports = {
  overrides: [
    {
      files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}', '**/*.spec.{js,jsx}'],
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  ],
};