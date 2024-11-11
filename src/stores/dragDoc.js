import { computed, ref } from 'vue'

const draggedDoc = ref(null)

function startDragging (doc) {
  // console.log('startDragging', doc)
  draggedDoc.value = doc
}

export default {
  isFolderDragged: computed(() => !!draggedDoc.value),
  draggedDoc: computed(() => draggedDoc.value),
  startDragging
}
