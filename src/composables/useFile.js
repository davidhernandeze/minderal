import { inject, ref } from 'vue'

export default (docRef) => {
  const attachmentUrl = ref(null)
  const format = ref(null)
  const workspace = inject('workspace')

  async function fetchFile () {
    if (!docRef.value._id) return
    const fileDocs = await workspace.fetchFileDocs(docRef.value)
    if (fileDocs.length === 0) return
    const attachment = Object.values(fileDocs[0]._attachments)[0]
    attachmentUrl.value = `data:${attachment.content_type};base64,${attachment.data}`
    format.value = attachment.content_type
  }

  return {
    attachmentUrl,
    format,
    fetchFile
  }
}
