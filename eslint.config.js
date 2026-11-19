// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'dist-android/*', '.omc/*', '.claude/*', 'e2e/.output/*', 'e2e/screenshots/*', 'src/content/*.generated.*', 'src/content/**/*.generated.*', '.expo/*'],
  },
]);
