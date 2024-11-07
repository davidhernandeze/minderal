/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,vue}',
  ],
  theme: {
    extend: {
      colors: {
        transparent: 'rgba(255, 255, 255, 0)',
      },
      fontSize: {
        xss: '0.6rem'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
}
