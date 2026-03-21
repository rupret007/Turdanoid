export default [
  {
    files: ['games/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Math: 'readonly',
        JSON: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        Uint32Array: 'readonly',
        crypto: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'never'],
      'arrow-spacing': 'error',
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'no-mixed-spaces-and-tabs': 'error',
      'indent': ['error', 2],
      'linebreak-style': ['error', 'unix']
    }
  }
];
