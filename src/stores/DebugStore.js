import { ref } from 'vue'

const lastReconnect = ref(null)
const reconnects = ref(0)
const offline = ref(false)

export default {
  lastReconnect,
  reconnects,
  offline
}
