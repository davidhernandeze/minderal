import { useMetadataStore } from '@/stores/metadata.js'
import PouchDB from 'pouchdb-browser'
import { ref, shallowRef } from 'vue'
import { Doc } from '@/types.js'
import moment from 'moment'

export function useDatabase (connectionId, documentId = '') {
  let database
  const username = ref('')
  const metadataStore = useMetadataStore()
  const connectionDone = ref(false)
  metadataStore.getConnectionInfo(connectionId).then(async (info) => {
    database = new PouchDB(info.connectionOptions)
    username.value = info.username
    await fetch()
    listenForChanges()
  })
  const currentDocumentId = ref(documentId)
  const currentDocument = shallowRef(null)
  const documents = ref([])
  const currentRoute = ref([])

  function listenForChanges () {
    database.changes({
      since: 'now',
      live: true,
      include_docs: true
    }).on('change', async function (change) {
      // To-do cases: delete/modify the current doc, delete/modify a doc in the route
      if (change.id === currentDocumentId.value) {
        await fetchCurrentDocument()
        return
      }
      const docIndex = documents.value.findIndex(doc => change.id === doc._id)
      const exists = docIndex !== -1
      let isChild = (change.doc?.parent_id || '') === currentDocumentId.value
      if (change.doc?._deleted) {
        isChild = (documents.value?.[docIndex]?.parent_id || '') === currentDocumentId.value
      }

      if (!isChild) return

      if (change.doc?._deleted) {
        documents.value.splice(docIndex, 1)
        return
      }
      if (!exists) {
        documents.value.push(new Doc(change.doc))
        return
      }

      documents.value[docIndex] = new Doc(change.doc)
    }).on('error', function (err) {
      console.log(err)
    })
  }

  async function fetch () {
    console.log('fetching doc...')
    await fetchCurrentDocument()
    await fetchDocuments()
    connectionDone.value = true
  }

  async function fetchCurrentDocument () {
    if (currentDocumentId.value === '') {
      currentDocument.value = null
      return
    }
    const doc = await database.get(currentDocumentId.value)
    currentDocument.value = new Doc(doc)
    await fetchCurrentDocumentRoute()
  }
  async function fetchDocuments () {
    console.log('fetching docs...')
    const allDocs = await database.find({
      selector: { parent_id: currentDocumentId.value ?? '' }
    })
    documents.value = allDocs.docs.sort((a, b) => a.order > b.order ? 1 : -1).map(doc => (new Doc(doc)))
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
      created_at: moment().toISOString(),
      created_by: username.value,
      value: widget.index === 'text' ? value : widget.defaultValue,
      name: widget.index === 'text' ? '' : value,
      type: widget.index,
      index_value: widget.indexValue,
      parent_id: currentDocumentId.value ?? '',
      order: docsLength ? documents.value[docsLength - 1].order + 100 : 0
    })
  }

  async function createDocWithValue (value, widget) {
    const docsLength = documents.value.length
    await database.post({
      created_at: moment().toISOString(),
      created_by: username.value,
      value,
      name: '',
      type: widget.index ?? widget,
      index_value: true,
      parent_id: currentDocumentId.value,
      order: docsLength ? documents.value[docsLength - 1].order + 100 : 0
    })
  }

  async function updateDocument (doc, value) {
    doc.value = value
    await database.put({ ...doc })
  }

  async function deleteDocument (doc) {
    await database.remove(doc)
  }

  async function renameDocument (doc, name) {
    doc.name = name
    await database.put({ ...doc })
  }

  async function setCurrentDocument (docId) {
    connectionDone.value = false
    currentDocumentId.value = docId
    await fetch()
  }

  async function closeConnection () {
    await database.close()
  }

  return {
    id: connectionId,
    username,
    currentDocument,
    currentRoute,
    documents,
    connectionDone,
    renameDocument,
    setCurrentDocument,
    createDocument,
    createDocWithValue,
    updateDocument,
    deleteDocument,
    closeConnection
  }
}
