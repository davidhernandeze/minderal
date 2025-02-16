import { computed, ref } from 'vue'
import { v4 as getId } from 'uuid'
import { useDoc } from '@/composables/useDoc.js'

export default (workspace, docRef, emits) => {
  const newItemInput = ref('')
  const doc = useDoc(workspace, docRef)
  const visibleItems = computed(() => doc.getContent())

  async function addItem () {
    const updatedList = doc.getContent()
    updatedList.push({
      id: getId(),
      value: newItemInput.value,
      checked: false
    })
    emits('update-value', { content: updatedList })
    newItemInput.value = ''
  }

  async function check (index) {
    const updatedList = doc.getContent()
    updatedList[index].checked = !updatedList[index].checked
    emits('update-value', { content: updatedList})
  }

  async function remove (index) {
    const updatedList = doc.getContent()
    updatedList.splice(index, 1)
    emits('update-value', { content: updatedList})
  }

  return {
    visibleItems,
    newItemInput,
    addItem,
    check,
    remove
  }
}
