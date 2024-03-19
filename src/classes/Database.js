import PouchDB from 'pouchdb-browser'
import moment from 'moment'
import { EventEmitter } from 'events'

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

  async getOrCreateDoc (id) {
    try {
      return await this.connection.get(id)
    } catch (e) {
      if (e.status !== 404) return null
      await this.connection.put({ _id: id })
      return await this.connection.get(id)
    }
  }

  async getDoc (id) {
    return await this.connection.get(id)
  }

  async createDoc (doc) {
    doc.created_at = moment().toISOString()
    await this.connection.post(doc)
  }

  async updateDoc (doc) {
    doc.updated_at = moment().toISOString()
    await this.connection.put(doc)
  }

  async deleteDoc (doc) {
    doc.deleted_at = moment().toISOString()
    await this.connection.put(doc)
  }

  startListening () {
    this.changesListener = this.connection.changes({
      since: 'now',
      live: true,
      include_docs: true,
      timeout: false
    })
      .on('change', (change) => {
        this.emit('change', change)
      })
  }

  monitorConnection () {
    this.connectionCheckInterval = setInterval(async () => {
      try {
        await this.getInfo()
        if (this.offline) {
          this.offline = false
          this.emit('reconnect')
          this.changesListener.cancel()
          this.startListening()
        }
      } catch (e) {
        this.emit('offline')
        this.offline = true
      }
    }, 20000)
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
    return docs
  }

  async closeConnection () {
    clearInterval(this.connectionCheckInterval)
    await this.connection.close()
  }
}
