import { useDoc } from '@/composables/useDoc.js'
import { ref } from 'vue'

export default (workspace, docRef) => {
  console.log(docRef.value)
  const { content } = useDoc(workspace, docRef)
  console.log(content)
  const value = ref(content || 0)

  function increment() {
    workspace.updateDoc(docRef.value, { content: value.value + 1 })
  }

  function decrement() {
    workspace.updateDoc(docRef.value, { content: value.value - 1 })
  }

  return {
    value,
    increment,
    decrement
  }
}
