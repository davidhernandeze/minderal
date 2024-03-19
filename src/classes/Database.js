import PouchDB from 'pouchdb-browser'
import moment from 'moment'

export default class Database {
  constructor ({ name, auth }) {
    this.name = name
    this.connection = new PouchDB({ name, auth, skipSetup: true })
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

  onChange (callback) {
    this.connection.changes({
      since: 'now',
      live: true,
      include_docs: true,
      retry: true
    }).on('change', callback)
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
    await this.connection.close()
  }
}
