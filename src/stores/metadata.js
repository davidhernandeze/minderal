import { defineStore } from 'pinia'
import { ref } from 'vue'
import PouchDB from 'pouchdb-browser'
import { v4 as getId } from 'uuid'
import sidebarStore from '@/stores/sidebar.js'
import Database from '@/classes/Database.js'

const META_DOC_ID = 'meta'
export const useMetadataStore = defineStore('metadata', () => {
  const metaDatabase = new Database({ name: 'minderal' })
  const connections = ref([])
  const tabs = ref([])
  async function fetchMetadata () {
    const metaDocument = await metaDatabase.getOrCreateDoc(META_DOC_ID)
    metaDocument.connections ??= []
    metaDocument.tabs ??= []
    if (metaDocument.tabs.length < 1) sidebarStore.showSidebar()
    connections.value = metaDocument.connections
    tabs.value = metaDocument.tabs
  }

  async function addConnection (name, host = null, username = null, password = null) {
    const id = getId()
    const options = { name }
    if (host) {
      options.name = `${host}/${options.name}`
    }
    if (username) {
      options.auth = { username, password }
    }
    const optionsToStore = JSON.parse(JSON.stringify(options))
    const newDatabase = new PouchDB(options)
    await newDatabase.createIndex({
      index: { fields: ['parent_id'] },
      ddoc: 'by_parent'
    })

    connections.value.push({ id, name, host, connectionOptions: optionsToStore, username: username || 'local' })
    const metaDocument = await metaDatabase.getOrCreateDoc(META_DOC_ID)
    metaDocument.connections = connections.value
    await metaDatabase.updateDoc(metaDocument)
  }

  async function removeConnection (connectionId) {
    await closeAllConnectionTabs(connectionId)
    const metaDocument = await metaDatabase.getOrCreateDoc(META_DOC_ID)
    connections.value = connections.value.filter(connection => connection.id !== connectionId)
    metaDocument.connections = connections.value
    await metaDatabase.updateDoc(metaDocument)
  }

  async function getConnectionInfo (connectionId) {
    const metaDocument = await metaDatabase.getOrCreateDoc(META_DOC_ID)
    return metaDocument.connections.find((connection) => connection.id === connectionId)
  }

  async function deleteDatabase (connectionId) {
    await closeAllConnectionTabs(connectionId)
    const metaDocument = await metaDatabase.getOrCreateDoc(META_DOC_ID)
    metaDocument.connections = metaDocument.connections.filter((connection) => connection.id !== connectionId)
    connections.value = metaDocument.connections
    const connection = await getConnectionInfo(connectionId)
    await new PouchDB(connection.name).destroy()
    await metaDatabase.updateDoc(metaDocument)
  }

  async function openNewTab (connectionId, databaseName) {
    const id = getId()
    tabs.value.forEach(tab => { tab.isOpen = false })
    tabs.value.push({ id, name: databaseName, connectionId, documentId: '', isOpen: true })
    const metaDocument = await metaDatabase.getOrCreateDoc(META_DOC_ID)
    metaDocument.tabs = tabs.value
    await metaDatabase.updateDoc(metaDocument)
  }

  async function openTab (tabIndex) {
    tabs.value.forEach(tab => { tab.isOpen = false })
    tabs.value[tabIndex].isOpen = true
    const metaDocument = await metaDatabase.getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.tabs = tabs.value
    await metaDatabase.updateDoc(metaDocument)
  }

  async function updateTabDocument (tabIndex, documentId) {
    tabs.value[tabIndex].documentId = documentId
    const metaDocument = await metaDatabase.getOrCreateDoc(META_DOC_ID)
    metaDocument.tabs = tabs.value
    await metaDatabase.updateDoc(metaDocument)
  }

  async function closeAllConnectionTabs (connectionId) {
    let tabIndexToClose
    do {
      tabIndexToClose = tabs.value.findIndex(tab => tab.connectionId === connectionId)
      if (tabIndexToClose !== -1) await closeTab(tabIndexToClose)
    } while (tabIndexToClose !== -1)
  }

  async function closeTab (tabIndex) {
    const tabIndexToOpen = tabIndex === 0 ? tabIndex + 1 : tabIndex - 1
    if (tabs.value[tabIndex].isOpen && tabIndexToOpen >= 0 && tabs.value.length > 1) {
      tabs.value[tabIndexToOpen].isOpen = true
    }
    tabs.value.splice(tabIndex, 1)
    const metaDocument = await metaDatabase.getOrCreateDoc(META_DOC_ID)
    metaDocument.tabs = tabs.value
    if (metaDocument.tabs.length === 0) sidebarStore.showSidebar()
    await metaDatabase.updateDoc(metaDocument)
  }

  return {
    connections,
    tabs,
    fetchMetadata,
    addConnection,
    removeConnection,
    getConnectionInfo,
    deleteDatabase,
    openNewTab,
    openTab,
    updateTabDocument,
    closeTab
  }
})
