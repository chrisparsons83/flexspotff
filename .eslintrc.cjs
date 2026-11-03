/**
 * @type {import('@types/eslint').Linter.BaseConfig}
 */
module.exports = {
  extends: [
    '@remix-run/eslint-config',
    '@remix-run/eslint-config/node',
    '@remix-run/eslint-config/jest-testing-library',
    'prettier',
  ],
  // We're using vitest which has a very similar API to jest
  // (so the linting plugins work nicely), but we have to
  // set the jest version explicitly.
  settings: {
    jest: {
      version: 27,
    },
  },
  overrides: [
    {
      // Sleeper calls go through app/libs/sleeper so each one is counted per
      // job run (#239 measures the savings) and retried the same way.
      files: ['**/*.ts', '**/*.tsx'],
      excludedFiles: [
        'app/libs/sleeper/**',
        'app/services/sleeperGraphql.server.ts',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          ...[
            'Literal[value=/api\\.sleeper\\.(app|com)|sleeper\\.com.graphql/]',
            'TemplateElement[value.raw=/api\\.sleeper\\.(app|com)|sleeper\\.com.graphql/]',
          ].map(selector => ({
            selector,
            message:
              'Call Sleeper through app/libs/sleeper (sleeperFetch or a wrapper in api.server.ts) so the call is counted.',
          })),
        ],
      },
    },
  ],
};
