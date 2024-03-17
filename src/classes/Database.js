import PouchDB from 'pouchdb-browser'
import moment from 'moment'

export default class Database {
  constructor ({ name, url = null }) {
    this.name = name
    this.url = url
    this.connection = new PouchDB(name)
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

  async updateDoc (doc) {
    doc.updated_at = moment().toISOString()
    await this.connection.put(doc)
  }
}
