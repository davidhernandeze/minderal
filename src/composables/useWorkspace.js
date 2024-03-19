import { useMetadataStore } from '@/stores/MetadataStore.js'
import { ref } from 'vue'
import { useDatabasePoolStore } from '@/stores/DatabasePoolStore.js'
import { Doc } from '@/classes/Doc.js'
import { widgets } from '@/enums/widgets.js'

export function useWorkspace ({ connectionId, docId = '' }) {
  const databasePoolStore = useDatabasePoolStore()
  const metadataStore = useMetadataStore()

  let db
  const childDocs = ref([])
  const username = ref('')
  const currentDoc = ref(null)
  const currentDocId = ref(docId)
  const currentRoute = ref([])
  const connectionDone = ref(false)


  async function connectDB () {
    const info = await metadataStore.getConnectionInfo(connectionId)
    db = await databasePoolStore.getOrCreateDB(info.connectionOptions)
    username.value = info.username
    db.onChange(onDatabaseChange)
    await fetch()
  }

  async function onDatabaseChange (change) {
    // To-do cases: delete/modify the current doc, delete/modify a doc in the route
    if (change.id === currentDocId.value) {
      await fetchCurrentDoc()
      return
    }
    const docIndex = childDocs.value.findIndex(doc => change.id === doc._id)
    const exists = docIndex !== -1
    let isChild = (change.doc?.parent_id || '') === currentDocId.value
    if (change.doc?._deleted) {
      isChild = (childDocs.value?.[docIndex]?.parent_id || '') === currentDocId.value
    }
    if (!isChild) return

    if (change.doc?._deleted) {
      if (!exists) return
      childDocs.value.splice(docIndex, 1)
      return
    }

    if (!exists) {
      childDocs.value.push(new Doc(change.doc))
      return
    }

    if (childDocs.value?.[docIndex].deleted_at !== change.doc.deleted_at) {
      await fetchChildDocs()
      return
    }

    childDocs.value[docIndex] = new Doc(change.doc)
  }

  async function fetch () {
    await fetchCurrentDoc()
    await fetchChildDocs()
    connectionDone.value = true
  }

  async function fetchCurrentDoc () {
    if (currentDocId.value === '') {
      currentDoc.value = null
      await fetchCurrentDocRoute()
      return
    }
    const doc = await db.getDoc(currentDocId.value)
    currentDoc.value = new Doc(doc)
    await fetchCurrentDocRoute()
  }

  async function fetchChildDocs () {
    const allDocs = await db.getDocsByParentId(currentDocId.value)
    childDocs.value = allDocs.sort((a, b) => a.order > b.order ? 1 : -1).map(doc => (new Doc(doc)))
  }

  async function fetchCurrentDocRoute () {
    let parentId = currentDocId.value
    const route = []
    while (parentId) {
      const parentDoc = await db.getDoc(parentId)
      route.push({
        id: parentId,
        name: parentDoc.name
      })
      parentId = parentDoc.parent_id
    }
    currentRoute.value = route.reverse()
  }

  async function createDoc({ name = '', content = null, widget = 'text', settings = {} }) {
    const widgetInfo = widgets[widget]
    const docsLength = childDocs.value.length
    const newDoc = new Doc({
      created_by: username.value,
      content: content || widgetInfo.defaultContent,
      name,
      widget,
      settings,
      parent_id: currentDocId.value ?? '',
      order: docsLength ? childDocs.value[docsLength - 1].order + 100 : 0,
    })
    await db.createDoc(newDoc)
  }

  async function updateDoc (doc, updatedFields) {
    for (const field in updatedFields) {
      doc[field] = updatedFields[field]
    }
    await db.updateDoc({ ...doc })
  }

  async function deleteDoc(doc) {
    await db.deleteDoc(doc)
  }

  async function deleteDocRecursively (doc) {
    const childDocs = await db.getDocsByParentId(doc._id)
    for (const childDoc of childDocs) {
      await deleteDocRecursively(childDoc)
    }
    await deleteDoc(doc)
  }

  async function renameDoc (doc, name) {
    doc.name = name
    await db.updateDoc(doc)
  }

  async function setCurrentDoc (docId) {
    connectionDone.value = false
    currentDocId.value = docId
    await fetch()
  }

  async function close () {
    await databasePoolStore.closeConnection(db.name)
  }

  return {
    id: connectionId,
    connectDB,
    username,
    currentDoc,
    currentRoute,
    childDocs,
    connectionDone,
    renameDoc,
    setCurrentDoc,
    createDoc,
    updateDoc,
    deleteDoc,
    deleteDocRecursively,
    close
  }
}
