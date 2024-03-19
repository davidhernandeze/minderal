import { ref } from 'vue'

const lastReconnect = ref(null)
const reconnects = ref(0)

export default {
  lastReconnect,
  reconnects
}
