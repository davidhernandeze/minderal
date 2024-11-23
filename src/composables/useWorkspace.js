import { useMetadataStore } from '@/stores/MetadataStore.js'
import { ref, watch } from 'vue'
import { v4 as getId } from 'uuid'
import { useDatabasePoolStore } from '@/stores/DatabasePoolStore.js'
import { Doc } from '@/classes/Doc.js'
import { widgets } from '@/enums/widgets.js'
import DebugStore from '@/stores/DebugStore.js'
import { useNetwork } from '@vueuse/core'

export function useWorkspace ({ connectionId, docId = '' }) {
  const databasePoolStore = useDatabasePoolStore()
  const metadataStore = useMetadataStore()
  const { lastReconnect, reconnects, offline } = DebugStore
  const { isOnline } = useNetwork()

  watch(isOnline, async (value) => {
    if (value) {
      await db?.startListening()
    } else {
      db?.setOffline()
    }
  })

  let db
  const childDocs = ref([])
  const username = ref('')
  const currentDoc = ref(null)
  const currentDocId = ref(docId)
  const rootDoc = ref(null)
  const currentRoute = ref([])
  const connectionDone = ref(false)

  async function connectDB () {
    const info = await metadataStore.getConnectionInfo(connectionId)
    db = await databasePoolStore.getOrCreateDB({ ...info.connectionOptions, listen: true })
    username.value = info.username
    db.on('change', onDatabaseChange)
    db.on('offline', () => { offline.value = true })
    db.on('reconnect', () => {
      reconnects.value += 1
      offline.value = false
      lastReconnect.value = new Date().toISOString()
      fetch()
    })
    await fetch()
  }

  async function onDatabaseChange (change) {
    // To-do cases: delete/modify the current doc, delete/modify a doc in the route
    if (change.id === currentDocId.value) {
      await fetchCurrentDoc()
      await fetchChildDocs()
      return
    }
    const docIndex = childDocs.value.findIndex(doc => change.id === doc._id)
    const exists = docIndex !== -1
    let isChild = (change.doc?.parent_id || '') === currentDocId.value
    if (change.doc?.deleted_at) {
      isChild = (childDocs.value?.[docIndex]?.parent_id || '') === currentDocId.value
    }
    if (!isChild) return

    if (change.doc?.deleted_at) {
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
      rootDoc.value = await db.getOrCreateDoc('root', { parent_id: 'root' })
      await fetchCurrentDocRoute()
      return
    }
    const doc = await db.getDoc(currentDocId.value)
    currentDoc.value = new Doc(doc)
    rootDoc.value = null
    await fetchCurrentDocRoute()
  }

  async function fetchChildDocs () {
    childDocs.value = await db.getDocsByParentId(currentDocId.value)
    await sortChildDocs()
  }

  async function sortChildDocs () {
    const docWithOrderProp = currentDoc.value || rootDoc.value
    let childOrder = docWithOrderProp.child_order || []
    const indexMap = {}

    childOrder.forEach((id, index) => {
      indexMap[id] = index
    })

    let orderCorrected = false

    const childrenIds = childDocs.value.map(doc => doc._id)

    if (childrenIds.length !== childOrder.length) {
      childOrder = childOrder.filter((id) => childrenIds.includes(id))
      orderCorrected = true
    }

    childrenIds.forEach((id) => {
      if (indexMap[id] === undefined) {
        orderCorrected = true
        indexMap[id] = childOrder.length
        childOrder.push(id)
      }
    })

    if (orderCorrected) {
      await updateDoc(docWithOrderProp, { child_order: childOrder })
    }

    childDocs.value = childDocs.value.sort((a, b) => {
      return indexMap[a._id] - indexMap[b._id]
    })
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

  async function createDoc ({ name = '', content = null, widget = 'text', settings = {}, files = [] }) {
    const widgetInfo = widgets[widget]
    const filesIds = []

    for (const file of files) {
      const fileDoc = await db.createDoc({
        name: file.name,
        created_by: username.value,
        _attachments: {
          [getId()]: {
            content_type: file.type,
            data: file.data
          }
        }
      })
      filesIds.push(fileDoc.id)
    }

    const newDoc = new Doc({
      created_by: username.value,
      content: content || widgetInfo.defaultContent,
      name,
      widget,
      settings,
      parent_id: currentDocId.value ?? '',
      files: filesIds
    })
    await db.createDoc(newDoc)
  }

  async function updateDoc (doc, updatedFields) {
    const updatedDoc = new Doc({ ...doc, ...updatedFields })
    return await db.updateDoc({ ...updatedDoc })
  }

  async function deleteDoc (doc) {
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

  async function fetchFileDocs (doc) {
    return await db.getDocsByIds(doc.files, true)
  }

  async function updateCurrentDocChildOrder (childOrder) {
    const docWithOrderProp = currentDoc.value || rootDoc.value
    await updateDoc(docWithOrderProp, { child_order: childOrder })
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
    close,
    fetchFileDocs,
    updateCurrentDocChildOrder
  }
}
