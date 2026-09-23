import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'src/generated/**', 'spikes/**', 'next-env.d.ts'] },
  // Spec §4: core never reaches into modules or app. This is what keeps the D-7
  // package extraction mechanical, so it is an error from the first commit.
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/modules/*', '@/modules/**', '**/modules/**'], message: 'src/core must not import from src/modules (spec §4).' },
          { group: ['@/app/*', '@/app/**', '**/app/**'], message: 'src/core must not import from src/app (spec §4).' },
        ],
      }],
    },
  },
];

export default config;
