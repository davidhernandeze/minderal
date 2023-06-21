import { ref } from 'vue'
import { useWindowSize } from '@vueuse/core'

const { width } = useWindowSize()
const isSidebarVisible = ref(width.value >= 640)

function showSidebar () {
  isSidebarVisible.value = true
}

function hideSidebar () {
  isSidebarVisible.value = false
}

function onTabOpen () {
  if (width.value < 640) {
    isSidebarVisible.value = false
  }
}

export default {
  isSidebarVisible,
  showSidebar,
  hideSidebar,
  onTabOpen
}
