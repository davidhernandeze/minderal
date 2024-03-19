import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import Database from '@/classes/Database.js'
import { useMetadataStore } from '@/stores/MetadataStore.js'

export const useDatabasePoolStore = defineStore('databasePoolStore', () => {
  const metaDataStore = useMetadataStore()
  const dbs = reactive(new Map())

  async function getOrCreateDB (connectionOptions) {
    const dbName = connectionOptions.name
    if (!dbs.has(dbName)) {
      const db = new Database(connectionOptions)
      dbs.set(dbName, db)
    }
    return dbs.get(dbName)
  }

  async function closeConnection (dbName) {
    if (!dbs.has(dbName)) return
    if (metaDataStore.tabs.find(tab => tab.name === dbName)) return
    const connection = dbs.get(dbName)
    try {
      connection.close()
    } catch (e) {}
    dbs.delete(dbName)
  }

  return {
    getOrCreateDB,
    closeConnection
  }
})
