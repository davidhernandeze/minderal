import { computed } from 'vue'

export default (documents, searchQuery) => {
  const filteredDocuments = computed(() => {
    return documents.value.filter((doc) => {
      let searchableContent = doc.name
      if (doc.index_value) {
        searchableContent += ' ' + doc.value
      }
      return searchableContent.toLowerCase().indexOf(searchQuery.value.toLowerCase()) > -1
    })
  })

  return {
    filteredDocuments
  }
}
