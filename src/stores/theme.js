import { computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'

const isDarkTheme = useStorage('dark-mode', true)

watch(isDarkTheme, () => {
  setDarkTheme()
})

function setDarkTheme() {
  if (isDarkTheme.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function toggleDarkMode() {
  isDarkTheme.value = !isDarkTheme.value
  setDarkTheme()
}

export default {
  isDarkTheme: computed(() => isDarkTheme.value),
  toggleDarkMode,
  setDarkTheme
}
