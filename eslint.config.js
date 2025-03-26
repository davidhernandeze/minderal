import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettierConfig from '@vue/eslint-config-prettier'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,vue}']
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**']
  },

  js.configs.recommended,

  ...pluginVue.configs['flat/recommended'],

  prettierConfig,

  {
    name: 'app/rules',
    rules: {
      skipBlankLines: 'off',
      'no-new': 'off',
      'vue/multi-word-component-names': 'off',
      // camelcase: 'off'
    }
  }
]
