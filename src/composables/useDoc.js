import { toValue } from '@vueuse/core'
import { toRaw } from 'vue'

export function useDoc (doc) {
  function get () {
    return toRaw(doc.value)
  }
  function getContent () {
    return get().value
  }

  return {
    get,
    getContent
  }
}
