import PouchDB from 'pouchdb-browser'
import moment from 'moment'
import { EventEmitter } from 'events'

interface AuthOptions {
  username: string
  password: string
}

interface ConnectionOptions {
  name: string
  auth?: AuthOptions
}

export class Connection extends EventEmitter {
  private name: string
  private client: PouchDB.Database
  private connectionCheckInterval: null | NodeJS.Timeout
  private offline: boolean
  private changesListener: null

  constructor(options: ConnectionOptions) {
    super()
    this.name = options.name
    this.client = new PouchDB(options.name, options)
    this.client.changes()
    this.connectionCheckInterval = null
    this.offline = true
    this.changesListener = null | Core.Changes
  }

  public async connect(): Promise<void> {
    await this.healthCheck()
    await this.monitorConnection()
  }

  async getInfo() {
    return await this.client.info()
  }

  async getOrCreateDoc(id, doc = {}) {
    try {
      return await this.client.get(id)
    } catch (e) {
      if (e.status !== 404) return null
      await this.connection.put({ _id: id, ...doc })
      return await this.client.get(id)
    }
  }

  async getDoc(id, includeAttachments = false) {
    return await this.client.get(id, { attachments: includeAttachments })
  }

  async createDoc(doc) {
    await this.startListening()
    doc.created_at = moment().toISOString()
    return await this.client.post(JSON.parse(JSON.stringify(doc)))
  }

  async createFileDoc(doc) {
    await this.startListening()
    doc.created_at = moment().toISOString()
    doc.updated_at = moment().toISOString()
    return await this.connection.post({ ...doc })
  }

  async updateDoc(doc) {
    await this.startListening()
    doc.updated_at = moment().toISOString()
    return await this.connection.put(JSON.parse(JSON.stringify(doc)), { attachments: false })
  }

  async deleteDoc(doc) {
    await this.startListening()
    doc.deleted_at = moment().toISOString()
    await this.connection.put(doc)
  }

  async hardDeleteDoc(doc) {
    await this.startListening()
    await this.client.remove(doc)
  }

  async healthCheck() {
    try {
      await this.getInfo()
      this.offline = false
      return true
    } catch {
      return false
    }
  }

  async startListening() {
    const wasOffline = this.offline
    this.changesListener?.cancel()
    this.changesListener = this.client
      .changes({
        since: 'now',
        live: true,
        include_docs: true,
        timeout: false
      })
      .on('change', (change) => {
        this.emit('change', change)
      })
    try {
      await this.getInfo()
    } catch {
      this.emit('offline')
      this.offline = true
      console.log('Offline by requesting db info')
      return
    }
    this.offline = false
    clearInterval(this.connectionCheckInterval)
    await this.monitorConnection()
    if (wasOffline) this.emit('reconnect')
  }

  async monitorConnection() {
    this.connectionCheckInterval = setInterval(async () => {
      await this.startListening()
    }, 10000)
  }

  async indexBy(field) {
    await this.client.createIndex({
      index: { fields: [field] },
      ddoc: `by_${field}`
    })
  }

  async getDocsByParentId(parentId, widget = null) {
    const selector = {
      parent_id: parentId,
      deleted_at: null
    }
    if (widget) {
      selector.widget = widget
    }

    const { docs } = await this.client.find({
      selector,
      limit: 9999
    })
    return docs.map((doc) => new Doc(doc))
  }

  async getDocsByIds(ids, includeAttachments = false) {
    const { rows } = await this.client.allDocs({
      keys: ids,
      include_docs: true,
      attachments: includeAttachments
    })
    return rows.map((row) => row.doc)
  }

  async closeConnection() {
    clearInterval(this.connectionCheckInterval)
    await this.client.close()
  }

  async getDocRevisions(docId) {
    const response = await this.client.get(docId, {
      revs: true
    })
    let initialPrefix = response._revisions.start
    return response._revisions?.ids.map((id) => {
      return `${initialPrefix--}-${id}`
    })
  }

  async getDocOnRevision(docId, revision) {
    return await this.client.get(docId, {
      rev: revision
    })
  }

  setOffline() {
    this.emit('offline')
    this.offline = true
    console.log('Offline by external source')
  }

  async migrate() {
    // this.client.allDocs({ include_docs: true }).then((result) => {
    //   const migratedDocs = result.rows
    //     .filter((row) => {
    //       return !row.id.includes('_design')
    //     })
    //     .filter((row) => {
    //       return row.doc.widget === 'text'
    //     })
    //     .map((row) => {
    //       const quill = new Quill(document.createElement('div'))
    //       quill.setContents(row.doc.content)
    //       const docText = quill.getText()
    //       console.log(docText)
    //       row.doc.content = quill.getText()
    //       return row.doc
    //     })
    //   console.log(migratedDocs)
    //   this.client.bulkDocs(migratedDocs).then(() => {
    //     console.log('Database migration complete')
    //   })
    // })
  }
}
