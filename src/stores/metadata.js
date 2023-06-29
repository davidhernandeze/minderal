import { defineStore } from 'pinia'
import { ref } from 'vue'
import PouchDB from 'pouchdb-browser'
import { getOrCreateDoc } from '@/functions/database.js'
import { v4 as getId } from 'uuid'
import sidebarStore from '@/stores/sidebar.js'

const META_DOC_ID = 'meta'
export const useMetadataStore = defineStore('metadata', () => {
  const metaDatabase = new PouchDB('minderal')
  const connections = ref([])
  const tabs = ref([])
  async function fetchMetadata () {
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
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
    // const byParentDesignDoc = {
    //   _id: '_design/shorts',
    //   views: {
    //     parent: {
    //       map: function (doc) {
    //         emit(doc.parent_id);
    //       }.toString()
    //     }
    //   }
    // }
    // await newDatabase.put(byParentDesignDoc)

    connections.value.push({ id, name, host, connectionOptions: optionsToStore })
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.connections = connections.value
    await metaDatabase.put(metaDocument)
  }

  async function removeConnection (connectionId) {
    await closeAllConnectionTabs(connectionId)
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    connections.value = connections.value.filter(connection => connection.id !== connectionId)
    metaDocument.connections = connections.value
    await metaDatabase.put(metaDocument)
  }

  async function getConnectionInfo (connectionId) {
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    return metaDocument.connections.find((connection) => connection.id === connectionId)
  }

  async function deleteDatabase (connectionId) {
    await closeAllConnectionTabs(connectionId)
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.connections = metaDocument.connections.filter((connection) => connection.id !== connectionId)
    connections.value = metaDocument.connections
    const connection = await getConnectionInfo(connectionId)
    await new PouchDB(connection.name).destroy()
    await metaDatabase.put(metaDocument)
  }

  async function openNewTab (connectionId, databaseName) {
    const id = getId()
    tabs.value.forEach(tab => { tab.isOpen = false })
    tabs.value.push({ id, name: databaseName, connectionId, documentId: null, isOpen: true })
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.tabs = tabs.value
    await metaDatabase.put(metaDocument)
  }

  async function openTab (tabIndex) {
    tabs.value.forEach(tab => { tab.isOpen = false })
    tabs.value[tabIndex].isOpen = true
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.tabs = tabs.value
    await metaDatabase.put(metaDocument)
  }

  async function updateTabDocument (tabIndex, documentId) {
    tabs.value[tabIndex].documentId = documentId
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.tabs = tabs.value
    await metaDatabase.put(metaDocument)
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
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.tabs = tabs.value
    if (metaDocument.tabs.length === 0) sidebarStore.showSidebar()
    await metaDatabase.put(metaDocument)
  }

  return { connections, tabs, fetchMetadata, addConnection, removeConnection, getConnectionInfo, deleteDatabase, openNewTab, openTab, updateTabDocument, closeTab }
})
