import { defineStore } from 'pinia'
import { ref } from 'vue'
import PouchDB from 'pouchdb-browser'
import { getOrCreateDoc } from '@/functions/database.js'
import { v4 as getId } from 'uuid'

const META_DOC_ID = 'meta'
export const useMetadataStore = defineStore('metadata', () => {
  const metaDatabase = new PouchDB('minderal')
  const databases = ref([])
  const tabs = ref([])
  async function fetchMetadata () {
    const sourcesDoc = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    sourcesDoc.databases ??= []
    sourcesDoc.tabs ??= []
    databases.value = sourcesDoc.databases
    tabs.value = sourcesDoc.tabs
  }

  async function createDatabase (name) {
    const id = getId()
    const newDatabase = new PouchDB(id)
    await newDatabase.createIndex({
      index: { fields: ['parent_id'] },
      ddoc: 'by_parent'
    })
    databases.value.push({ id, name })
    const sourcesDoc = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    sourcesDoc.databases = databases.value
    await metaDatabase.put(sourcesDoc)
  }

  async function deleteDatabase (id) {
    const sourcesDoc = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    sourcesDoc.databases = sourcesDoc.databases.filter((db) => db.id !== id)
    databases.value = sourcesDoc.databases
    await new PouchDB(id).destroy()
    await metaDatabase.put(sourcesDoc)
  }

  async function openNewTab (databaseId, databaseName) {
    const id = getId()
    tabs.value.forEach(tab => { tab.isOpen = false })
    tabs.value.push({ id, name: databaseName, databaseId, documentId: null, isOpen: true })
    const sourcesDoc = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    sourcesDoc.tabs = tabs.value
    await metaDatabase.put(sourcesDoc)
  }

  async function openTab (tabIndex) {
    tabs.value.forEach(tab => { tab.isOpen = false })
    tabs.value[tabIndex].isOpen = true
    const sourcesDoc = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    sourcesDoc.tabs = tabs.value
    await metaDatabase.put(sourcesDoc)
  }

  async function closeTab (tabIndex) {
    const tabIndexToOpen = tabIndex - 1
    if (tabs.value[tabIndex].isOpen && tabIndexToOpen >= 0) {
      tabs.value[tabIndexToOpen].isOpen = true
    }
    tabs.value.splice(tabIndex, 1)
    const sourcesDoc = await getOrCreateDoc(metaDatabase, META_DOC_ID)
    sourcesDoc.tabs = tabs.value
    await metaDatabase.put(sourcesDoc)
  }

  return { databases, tabs, fetchMetadata, createDatabase, deleteDatabase, openNewTab, openTab, closeTab }
})
