import { ref, toValue, watch } from 'vue'

export function useDoc(workspace, docRef) {
  const content = ref(docRef.value.content)
  const isEditing = ref(false)

  watch(docRef, (value) => {
    content.value = toValue(value.content)
  })

  function get() {
    return toValue(docRef.value)
  }

  function getContent() {
    return get().content
  }

  async function updateContent() {
    const { rev } = await workspace.updateDoc(docRef.value, { content: toValue(content.value) })
    docRef.value._rev = rev
  }

  async function startEdition() {
    isEditing.value = true
  }

  async function exitEdition() {
    if (!isEditing.value) return
    isEditing.value = false
    await updateContent()
  }

  return {
    content,
    get,
    getContent,
    startEdition,
    exitEdition,
  }
}
