
import PouchDB from 'pouchdb-browser'
import { ref } from 'vue'

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
  const currentDocumentName = ref('')
  const currentDocumentRoute = ref([])

  console.log('init db conn')

  database.changes({
    since: 'now'
  }).on('change', function (change) {
    console.log(change)
  }).on('error', function (err) {
    // handle errors
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
    let parentName = currentDocumentName.value
    const route = []
    while (parentId) {
      route.push({
        id: parentId,
        name: parentName
      })
      const parentDocument = await database.get(parentId)
      parentName = parentDocument.value
      parentId = parentDocument.parent_id
    }
    currentDocumentRoute.value = route
    console.log(route)
  }

  async function createDocument (value) {
    const docsLength = documents.value.length
    await database.post({
      value,
      type: 'text',
      parent_id: currentDocumentId.value ?? false,
      order: docsLength ? documents.value[docsLength - 1].order + 100 : 0
    })
    await fetchDocuments()
  }
  async function deleteDocument (document) {
    await database.remove(document)
    await fetchDocuments()
  }

  async function setCurrentDocument (document) {
    currentDocumentId.value = document._id
    currentDocumentName.value = document.value
    await fetchDocuments()
  }

  return {
    id: databaseId,
    currentDocumentId,
    currentDocumentRoute,
    documents,
    fetchDocuments,
    setCurrentDocument,
    createDocument,
    deleteDocument
  }
}
