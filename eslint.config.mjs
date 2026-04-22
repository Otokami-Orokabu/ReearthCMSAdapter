import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.cjs',
    ],
  },
  ...tseslint.configs.strict,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // @hw/reearth-api-server は公開エントリ (index) 経由でのみ import 可能
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@hw/reearth-api-server/*', '**/reearth-api-server/src/*'],
            message: '@hw/reearth-api-server は公開エントリ (index) 経由でのみ import してください',
          },
        ],
      }],
    },
  },
);
