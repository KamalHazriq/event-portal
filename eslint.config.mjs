import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * eslint-config-next 16 ships flat config, so it is imported directly and
 * there is no need for the old FlatCompat shim.
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },

  ...coreWebVitals,
  ...nextTypescript,

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      /**
       * Brief hard rule 4: pages and components never import the database
       * directly, everything goes through the data adapter. This makes that
       * rule something the linter enforces rather than something to remember.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '@prisma/adapter-*', 'better-sqlite3'],
              message:
                'Only src/data/sqlite may touch Prisma. Everything else goes through the adapter: import { getData } from "@/data".',
            },
          ],
        },
      ],
    },
  },

  {
    // The one place allowed to know which database is underneath.
    files: ['src/data/sqlite/**', 'scripts/**', 'prisma*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
];

export default config;
