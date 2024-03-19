import { computed, ref, watch } from 'vue'
import moment from 'moment'
import { useWebNotification } from '@vueuse/core'
import icon from '@/assets/logo310x310.png'

export default (workspace) => {
  const {
    isSupported,
    show
  } = useWebNotification({
    dir: 'auto',
    lang: 'en',
    icon
  })

  const inputValue = ref('')
  const messages = computed(() => {
    return workspace.childDocs.value.map(doc => ({
      id: doc._id,
      message: doc.content.message,
      sent_by: doc.created_by,
      created_at: moment(doc.created_at).fromNow(),
      is_own: doc.created_by === workspace.username.value
    }))
  })

  watch(messages, value => {
    if (!isSupported.value || value[value.length - 1]?.is_own) return
    show({ title: 'New Message received in /' + workspace.currentDocument.value.name })
  })

  async function send () {
    if (inputValue.value.length === 0) return
    const newMessage = {
      message: inputValue.value
    }
    await workspace.createDoc({ content: newMessage, widget: 'message' })
    inputValue.value = ''
  }

  return {
    messages,
    inputValue,
    send
  }
}
