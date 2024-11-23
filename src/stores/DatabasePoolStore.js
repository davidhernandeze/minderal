import { defineStore } from 'pinia'
import { reactive } from 'vue'
import Database from '@/classes/Database.js'
import { useMetadataStore } from '@/stores/MetadataStore.js'

export const useDatabasePoolStore = defineStore('databasePoolStore', () => {
  const metaDataStore = useMetadataStore()
  const dbs = reactive(new Map())

  async function getOrCreateDB (connectionOptions) {
    const dbName = connectionOptions.name
    if (!dbs.has(dbName)) {
      const db = new Database(connectionOptions)
      db.clients = 1
      dbs.set(dbName, db)
    }
    const db = dbs.get(dbName)
    db.clients++
    return db
  }

  async function closeConnection (dbName) {
    if (!dbs.has(dbName)) return
    const db = dbs.get(dbName)
    db.clients--
    if (db.clients > 0) return
    try {
      db.closeConnection()
    } catch (e) {
      console.log('Error closing connection', e)
    }
    dbs.delete(dbName)
  }

  return {
    getOrCreateDB,
    closeConnection
  }
})
