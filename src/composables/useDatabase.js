import { useMetadataStore } from '@/stores/metadata.js'
import PouchDB from 'pouchdb-browser'
import { ref } from 'vue'

export function useDatabase (databaseId) {
  let database
  const metadataStore = useMetadataStore()
  metadataStore.getConnectionInfo(databaseId).then(async (info) => {
    database = new PouchDB(info.connectionOptions)
    await fetchDocuments()
    listenForChanges()
  })
  const documents = ref([])
  const currentDocumentId = ref('')
  const currentRoute = ref([])

  function listenForChanges () {
    database.changes({
      since: 'now',
      live: true
    }).on('change', async function (change) {
      await fetchDocuments()
    }).on('error', function (err) {
      console.log(err)
    })
  }

  async function fetchDocuments (parentId = currentDocumentId.value) {
    const allDocs = await database.find({
      selector: { parent_id: parentId ?? false }
    })
    documents.value = allDocs.docs.sort((a, b) => a.order > b.order ? 1 : -1)
    await fetchCurrentDocumentRoute()
  }

  async function fetchCurrentDocumentRoute () {
    let parentId = currentDocumentId.value
    const route = []
    while (parentId) {
      const parentDocument = await database.get(parentId)
      route.push({
        id: parentId,
        name: parentDocument.name
      })
      parentId = parentDocument.parent_id
    }
    currentRoute.value = route.reverse()
  }

  async function createDocument (value, widget) {
    const docsLength = documents.value.length
    await database.post({
      value: widget.index === 'text' ? value : widget.defaultValue,
      name: widget.index === 'text' ? '' : value,
      type: widget.index,
      index_value: widget.indexValue,
      parent_id: currentDocumentId.value ?? false,
      order: docsLength ? documents.value[docsLength - 1].order + 100 : 0
    })
    await fetchDocuments()
  }

  async function updateDocument (document, value) {
    document.value = value
    await database.put(document)
    await fetchDocuments()
  }

  async function deleteDocument (document) {
    await database.remove(document)
    await fetchDocuments()
  }

  async function setCurrentDocument (documentId) {
    currentDocumentId.value = documentId
    await fetchDocuments()
  }

  return {
    id: databaseId,
    currentDocumentId,
    currentRoute,
    documents,
    fetchDocuments,
    setCurrentDocument,
    createDocument,
    updateDocument,
    deleteDocument
  }
}
