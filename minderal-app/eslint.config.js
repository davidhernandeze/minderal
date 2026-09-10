import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettierConfig from '@vue/eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,ts,tsx,vue}']
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**']
  },

  js.configs.recommended,

  // Enable TypeScript rules for .ts/.tsx files
  ...tseslint.configs.recommended,

  // Vue recommended config (works with TS inside <script lang="ts">)
  ...pluginVue.configs['flat/recommended'],

  // Ensure Vue SFCs delegate <script lang="ts"> blocks to the TS parser
  {
    name: 'app/vue-ts-parser',
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        // vue-eslint-parser is set by the Vue config; this tells it to use the
        // TypeScript parser for <script lang="ts"> blocks.
        parser: tseslint.parser
      }
    }
  },

  // Keep Prettier last to turn off formatting-related ESLint rules
  prettierConfig,

  {
    name: 'app/rules',
    rules: {
      skipBlankLines: 'off',
      'no-new': 'off',
      'vue/multi-word-component-names': 'off'
      // camelcase: 'off'
    }
  }
]
