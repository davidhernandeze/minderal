import { ref, toValue, watch } from 'vue'

export function useDoc(workspace, doc) {
  const content = ref(toValue(doc.value.content))
  const isEditing = ref(false)

  watch(
    () => doc,
    (value) => {
      console.log('doc changed externally', value)
      content.value = toValue(value)
    },
  )

  function get() {
    return toValue(doc.value)
  }

  function getContent() {
    return get().content
  }

  async function updateContent() {
    console.log('updating content')
    await workspace.updateDoc(doc.value, { content: toValue(content.value) })
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
