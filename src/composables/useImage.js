import { inject, ref } from 'vue'

export default (docRef) => {
  const attachmentUrl = ref(null)
  const workspace = inject('workspace')

  async function fetchImage () {
    const fileDocs = await workspace.fetchFileDocs(docRef)
    if (fileDocs.length === 0) return
    const attachment = Object.values(fileDocs[0]._attachments)[0]
    attachmentUrl.value = `data:${attachment.content_type};base64,${attachment.data}`
  }

  return {
    attachmentUrl,
    fetchImage
  }
}
