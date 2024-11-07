import { inject, ref } from 'vue'

export default (docRef) => {
  const attachmentUrl = ref(null)
  const workspace = inject('workspace')

  async function fetchImage () {
    const attachmentsObject = await workspace.fetchDocAttachments(docRef._id)
    const attachmentsList = Object.values(attachmentsObject)

    if (attachmentsList.length === 0) return

    const attachment = attachmentsList[0]
    attachmentUrl.value = `data:${attachment.content_type};base64,${attachment.data}`
  }

  return {
    attachmentUrl,
    fetchImage
  }
}
