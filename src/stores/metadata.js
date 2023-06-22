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
    connections.value.push({ id, name, connectionOptions: optionsToStore })
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.connections = connections.value
    await metaDatabase.put(metaDocument)
  }

  async function getConnectionInfo (databaseId) {
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    return metaDocument.connections.find((connection) => connection.id === databaseId)
  }

  async function deleteDatabase (id) {
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.databases = metaDocument.databases.filter((db) => db.id !== id)
    connections.value = metaDocument.databases
    await new PouchDB(id).destroy()
    await metaDatabase.put(metaDocument)
  }

  async function openNewTab (databaseId, databaseName) {
    const id = getId()
    tabs.value.forEach(tab => { tab.isOpen = false })
    tabs.value.push({ id, name: databaseName, databaseId, documentId: null, isOpen: true })
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

  async function closeTab (tabIndex) {
    const tabIndexToOpen = tabIndex - 1
    if (tabs.value[tabIndex].isOpen && tabIndexToOpen >= 0) {
      tabs.value[tabIndexToOpen].isOpen = true
    }
    tabs.value.splice(tabIndex, 1)
    const metaDocument = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    metaDocument.tabs = tabs.value
    if (metaDocument.tabs.length === 0) sidebarStore.showSidebar()
    await metaDatabase.put(metaDocument)
  }

  return { connections, tabs, fetchMetadata, addConnection, getConnectionInfo, deleteDatabase, openNewTab, openTab, updateTabDocument, closeTab }
})
