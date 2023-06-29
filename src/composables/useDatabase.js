import { useMetadataStore } from '@/stores/metadata.js'
import PouchDB from 'pouchdb-browser'
import { ref } from 'vue'

export function useDatabase (connectionId, documentId = '') {
  let database
  const metadataStore = useMetadataStore()
  const connectionDone = ref(false)
  metadataStore.getConnectionInfo(connectionId).then(async (info) => {
    database = new PouchDB(info.connectionOptions)
    await fetch()
    listenForChanges()
  })
  const currentDocumentId = ref(documentId)
  const currentDocument = ref()
  const documents = ref([])
  const currentRoute = ref([])

  function listenForChanges () {
    database.changes({
      since: 'now',
      live: true,
      include_docs: true
    }).on('change', async function (change) {
      if (change.id !== currentDocumentId.value && change.doc.parent_id !== currentDocumentId.value) return
      await fetch()
    }).on('error', function (err) {
      console.log(err)
    })
  }

  async function fetch () {
    console.log('fetching...')
    await fetchCurrentDocument()
    await fetchDocuments()
    connectionDone.value = true

    // database.query('shorts/parent').then(function (res) {
    //   console.log(res)
    // }).catch(function (err) {
    //   console.log('???')
    //   console.log(err)
    // })
  }

  async function fetchCurrentDocument () {
    if (!currentDocumentId.value) {
      currentDocument.value = null
      return
    }
    currentDocument.value = await database.get(currentDocumentId.value)
  }
  async function fetchDocuments () {
    const allDocs = await database.find({
      selector: { parent_id: currentDocumentId.value ?? '' }
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
      parent_id: currentDocumentId.value ?? '',
      order: docsLength ? documents.value[docsLength - 1].order + 100 : 0
    })
    await fetchDocuments()
  }

  async function updateDocument (document, value) {
    document.value = value
    await database.put(document)
    await fetch()
  }

  async function deleteDocument (document) {
    await database.remove(document)
    await fetch()
  }

  async function setCurrentDocument (documentId) {
    connectionDone.value = false
    currentDocumentId.value = documentId
    await fetch()
  }

  async function closeConnection () {
    await database.close()
  }

  return {
    id: connectionId,
    currentDocument,
    currentRoute,
    documents,
    connectionDone,
    setCurrentDocument,
    createDocument,
    updateDocument,
    deleteDocument,
    closeConnection
  }
}
