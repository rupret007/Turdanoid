/** @type {import('eslint').Linter.Config} */
export default [
  {
    files: ['**/*.js'],
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn'
    }
  }
];
