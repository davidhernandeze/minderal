module.exports = {
  extends: [
    'standard',
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
  ],
  rules: {
    'skipBlankLines': 'off',
    'no-new': 'off',
    'vue/multi-word-component-names': 'off',
    "vue/block-order": ["error", {
      "order": [ "script", "template" , "style" ]
    }],
    'camelcase': 'off'
  },
  parserOptions: {
    'ecmaVersion': 'latest'
  }
}
