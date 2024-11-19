import { ref, watchEffect } from 'vue'
import { getWidgetProps } from '@/enums/widgets.js'

export default (documents, searchQuery) => {
  const filteredDocuments = ref([])
  const folderDocuments = ref([])
  const widgetDocuments = ref([])

  watchEffect(() => {
    filteredDocuments.value = documents.value.filter((doc) => {
      let searchableContent = doc.name
      const widgetProps = getWidgetProps(doc.widget)
      if (widgetProps?.indexContent) {
        searchableContent += ' ' + doc.value
      }
      return searchableContent.toLowerCase().indexOf(searchQuery.value.toLowerCase()) > -1
    })
    folderDocuments.value = filteredDocuments.value.filter((doc) => doc.widget === 'folder')
    widgetDocuments.value = filteredDocuments.value.filter((doc) => doc.widget !== 'folder')
  })
  return {
    filteredDocuments,
    folderDocuments,
    widgetDocuments
  }
}
