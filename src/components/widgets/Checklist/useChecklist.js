import { computed, ref } from 'vue'
import { v4 as getId } from 'uuid'
import { useDoc } from '@/composables/useDoc.js'

export default (docRef, emits) => {
  const newItem = ref('')
  const doc = useDoc(docRef)
  const visibleItems = computed(() => doc.getContent())

  async function addItem () {
    const updatedList = doc.getContent()
    updatedList.push({
      id: getId(),
      value: newItem.value,
      checked: false
    })
    emits('update', updatedList)
    newItem.value = ''
  }

  async function check (index) {
    const updatedList = doc.getContent()
    updatedList[index].checked = !updatedList[index].checked
    emits('update', updatedList)
  }

  async function remove (index) {
    const updatedList = doc.getContent()
    updatedList.splice(index, 1)
    emits('update', updatedList)
  }

  return {
    visibleItems,
    newItem,
    addItem,
    check,
    remove
  }
}
