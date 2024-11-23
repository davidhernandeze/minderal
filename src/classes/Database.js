import PouchDB from 'pouchdb-browser'
import moment from 'moment'
import { EventEmitter } from 'events'
import { Doc } from '@/classes/Doc.js'

export default class Database extends EventEmitter {
  constructor ({ name, auth, listen = false }) {
    super()
    this.name = name
    this.connection = new PouchDB({ name, auth, skipSetup: true })
    this.connectionCheckInterval = null
    this.offline = false
    this.changesListener = null

    if (!listen) return

    this.startListening()
    this.monitorConnection()
  }

  async getInfo () {
    return await this.connection.info()
  }

  async getOrCreateDoc (id, doc = {}) {
    try {
      return await this.connection.get(id)
    } catch (e) {
      if (e.status !== 404) return null
      await this.connection.put({ _id: id, ...doc })
      return await this.connection.get(id)
    }
  }

  async getDoc (id, includeAttachments = false) {
    return await this.connection.get(id, { attachments: includeAttachments })
  }

  async createDoc (doc) {
    await this.startListening()
    doc.created_at = moment().toISOString()
    return await this.connection.post(doc)
  }

  async updateDoc (doc) {
    await this.startListening()
    doc.updated_at = moment().toISOString()
    await this.connection.put(doc, { attachments: false })
  }

  async deleteDoc (doc) {
    await this.startListening()
    doc.deleted_at = moment().toISOString()
    await this.connection.put(doc)
  }

  async startListening () {
    const wasOffline = this.offline
    try {
      await this.getInfo()
    } catch (e) {
      this.emit('offline')
      this.offline = true
      console.log('Offline by requesting db info')
      return
    }
    this.changesListener?.cancel()
    this.changesListener = this.connection.changes({
      since: 'now',
      live: true,
      include_docs: true,
      timeout: false
    })
      .on('change', (change) => {
        this.emit('change', change)
      })
    console.log('Online')
    this.offline = false
    if (wasOffline) this.emit('reconnect')
  }

  async monitorConnection () {
    this.connectionCheckInterval = setInterval(async () => {
      await this.startListening()
    }, 10000)
  }

  async indexBy (field) {
    await this.connection.createIndex({
      index: { fields: [field] },
      ddoc: `by_${field}`
    })
  }

  async getDocsByParentId (parentId) {
    const { docs } = await this.connection.find({
      selector: {
        parent_id: parentId,
        deleted_at: null
      }
    })
    return docs.map(doc => new Doc(doc))
  }

  async getDocsByIds (ids, includeAttachments = false) {
    const { rows } = await this.connection.allDocs({
      keys: ids,
      include_docs: true,
      attachments: includeAttachments
    })
    return rows.map(row => row.doc)
  }

  async closeConnection () {
    clearInterval(this.connectionCheckInterval)
    await this.connection.close()
  }

  setOffline () {
    this.emit('offline')
    this.offline = true
    console.log('Offline by external source')
  }
}
