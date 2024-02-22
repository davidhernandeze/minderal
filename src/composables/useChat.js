import { computed, ref } from 'vue'
import moment from 'moment'

export default (db) => {
  const inputValue = ref('')
  const messages = computed(() => {
    return db.documents.value.map(doc => ({
      id: doc._id,
      message: doc.value.message,
      sent_by: doc.created_by,
      created_at: moment(doc.created_at).fromNow(),
      is_own: doc.created_by === db.username.value
    }))
  })

  async function send () {
    if (inputValue.value.length === 0) return
    const newMessage = {
      message: inputValue.value
    }
    await db.createDocWithValue(newMessage, 'message')
    inputValue.value = ''
  }

  return {
    messages,
    inputValue,
    send
  }
}
