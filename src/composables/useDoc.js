import { ref, toValue, watch } from 'vue'

export function useDoc(workspace, doc) {
  const content = ref(doc.value.content)
  const isEditing = ref(false)

  watch(doc, (value) => {
    content.value = toValue(value.content)
  })

  function get() {
    return toValue(doc.value)
  }

  function getContent() {
    return get().content
  }

  async function updateContent() {
    const { rev } = await workspace.updateDoc(doc.value, { content: toValue(content.value) })
    doc.value._rev = rev
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
