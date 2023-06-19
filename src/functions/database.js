
import PouchDB from 'pouchdb-browser'
import { ref } from 'vue'
import { widgets } from '@/enums/widgets.js'

export async function getOrCreateDoc (database, id) {
  try {
    return await database.get(id)
  } catch (e) {
    if (e.status !== 404) return null
    await database.put({ _id: id })
    return await database.get(id)
  }
}

export function getDatabaseConnection (databaseId) {
  const database = new PouchDB(databaseId)
  const documents = ref([])
  const currentDocumentId = ref('')
  const currentRoute = ref([])

  database.changes({
    since: 'now'
  }).on('change', function (change) {
    console.log(change)
  }).on('error', function (err) {
    console.log(err)
  })

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

  async function createDocument (value, type) {
    const docsLength = documents.value.length
    await database.post({
      value: type === 'text' ? value : '',
      name: type === 'text' ? '' : value,
      type,
      index_value: type.indexValue,
      parent_id: currentDocumentId.value ?? false,
      order: docsLength ? documents.value[docsLength - 1].order + 100 : 0
    })
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
    deleteDocument
  }
}
