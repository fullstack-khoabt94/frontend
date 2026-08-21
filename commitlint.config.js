export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Scopes are optional, but when present keep them lowercase and short.
    'scope-case': [2, 'always', 'kebab-case'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
  },
}
