import { ref } from 'vue'
const isSidebarVisible = ref(false)

function showSidebar () {
  isSidebarVisible.value = true
}

function hideSidebar () {
  isSidebarVisible.value = false
}

export default {
  isSidebarVisible,
  showSidebar,
  hideSidebar
}
