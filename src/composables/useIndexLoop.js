import { ref, watch } from 'vue'

export default (listRef) => {
  const currentIndex = ref(0)

  watch(listRef, () => {
    currentIndex.value = 0
  })

  function restart() {
    currentIndex.value = 0
  }

  function increment() {
    if (currentIndex.value === listRef.value.length - 1) {
      restart()
      return
    }
    currentIndex.value++
  }

  function decrement() {
    if (currentIndex.value === 0) {
      currentIndex.value = listRef.value.length - 1
      return
    }
    currentIndex.value--
  }

  return {
    currentIndex,
    restart,
    increment,
    decrement
  }
}
