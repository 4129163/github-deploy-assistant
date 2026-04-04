module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ['airbnb-base'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-console': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'no-underscore-dangle': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: 'next|req|res' }],
    'consistent-return': 'off',
    'max-len': ['error', { code: 120, ignoreComments: true }],
    'no-param-reassign': ['error', { props: false }],
    'class-methods-use-this': 'off',
    'no-plusplus': 'off',
    'no-restricted-syntax': 'off',
    'no-await-in-loop': 'off',
    'prefer-destructuring': 'off',
    'global-require': 'off',
    'camelcase': 'off',
    'quote-props': ['error', 'consistent-as-needed']
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'logs/', 'workspace/', 'database/']
};