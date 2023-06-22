import { computed, ref } from 'vue'
import { useWindowSize } from '@vueuse/core'

const { width } = useWindowSize()
const isVisible = ref(width.value >= 640)

function showSidebar () {
  isVisible.value = true
}

function hideSidebar () {
  isVisible.value = false
}

function onTabOpen () {
  if (width.value < 640) {
    hideSidebar()
  }
}

export default {
  isSidebarVisible: computed(() => isVisible.value),
  showSidebar,
  hideSidebar,
  onTabOpen
}
