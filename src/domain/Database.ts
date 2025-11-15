import { v4 as generateId } from 'uuid'
import PouchDB from 'pouchdb-browser'
import moment from 'moment'
import { EventEmitter } from 'events'
import { Doc } from '@/classes/Doc.js'
import { Connection } from '@/domain/Connection'
import { ConfigDocStructure, DatabaseConfig } from '@/domain/types/config'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'

interface ChangeListener {
  cancel: () => void
}

export class Database extends EventEmitter {
  id: string
  name: string
  online: boolean = false
  username: string

  private connection: Connection
  private client: PouchDB.Database
  private clientCheckInterval: NodeJS.Timeout | null = null
  private changesListener: null | ChangeListener = null

  constructor(name: string, connection: Connection) {
    console.log(name)
    super()
    this.id = generateId()
    this.client = new PouchDB(name, connection.config)
    this.username = connection.config?.auth?.username || 'local'
    this.connection = connection
  }

  getConfig(): DatabaseConfig {
    return {
      name: this.name
    }
  }

  getConnectionId(): string {
    return this.connection.id
  }

  getConnectionName(): string {
    return this.connection.name
  }

  async startListeningWithMonitoring() {
    await this.startListening()
    await this.monitorClient()
  }

  async getInfo() {
    return await this.client.info()
  }

  async getOrCreateWidgetDoc(id: string, doc?: WidgetDocStructure): Promise<WidgetDocStructure> {
    try {
      return await this.client.get(id)
    } catch (e) {
      if (e.status !== 404) return null
      await this.client.put({ _id: id, ...doc })
      return await this.client.get(id)
    }
  }

  async getOrCreateConfigDoc(): Promise<ConfigDocStructure> {
    try {
      return await this.client.get('config')
    } catch (e) {
      if (e.status !== 404) return null
      await this.client.put({ _id: 'config', connections: [], tabs: [] })
      return await this.client.get('config')
    }
  }

  async getDoc(id: string, includeAttachments = false): Promise<WidgetDocStructure> {
    return await this.client.get(id, { attachments: includeAttachments })
  }

  async createDoc(doc: WidgetDocStructure): Promise<WidgetDocStructure> {
    await this.startListening()
    doc.created_at = moment().toISOString()
    const { rev } = await this.client.post(doc)
    doc._rev = rev
    return doc
  }

  async createFileDoc(doc) {
    await this.startListening()
    doc.created_at = moment().toISOString()
    doc.updated_at = moment().toISOString()
    return await this.client.post({ ...doc })
  }

  async updateDoc(doc: Doc | ConfigDoc): Promise<string> {
    await this.startListening()
    doc.updated_at = moment().toISOString()
    const response = await this.client.put(doc, { attachments: false })
    return response.rev
  }

  async deleteDoc(doc) {
    await this.startListening()
    doc.deleted_at = moment().toISOString()
    await this.client.put(doc)
  }

  async hardDeleteDoc(doc) {
    await this.startListening()
    await this.client.remove(doc)
  }

  async startListening() {
    const wasOffline = !this.online
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
      this.online = false
      this.emit('change')
      console.log('Offline by requesting db info')
      return
    }
    this.online = true
    this.emit('change')
    clearInterval(this.clientCheckInterval)
    await this.monitorClient()
    if (wasOffline) this.emit('reconnect')
  }

  async monitorClient() {
    this.clientCheckInterval = setInterval(async () => {
      await this.startListening()
    }, 10000)
  }

  async indexBy(field: string) {
    await this.client.createIndex({
      index: { fields: [field], ddoc: `by_${field}` }
    })
  }

  async getDocsByParentId(parentId: string, widget = null) {
    const selector: { parent_id: string; deleted_at: string | null; widget?: string } = {
      parent_id: parentId,
      deleted_at: null
    }
    if (widget) {
      selector.widget = widget
    }

    const response: PouchDB.Find.FindResponse<unknown> = await this.client.find({
      selector,
      limit: 9999
    })
    return response.docs.map((doc) => new Doc(doc))
  }

  async getDocsByIds(ids: string[], includeAttachments: boolean = false) {
    const response = await this.client.allDocs({
      keys: ids,
      include_docs: true,
      attachments: includeAttachments
    })
    return response.rows.map(({ doc }) => doc)
  }

  async closeClient() {
    clearInterval(this.clientCheckInterval)
    await this.client.close()
  }

  async getDocRevisions(id: string) {
    const response = await this.client.get(id, {
      revs: true
    })
    let initialPrefix = response._revisions.start
    return response._revisions?.ids.map((id) => {
      return `${initialPrefix--}-${id}`
    })
  }

  async getDocOnRevision(id: string, revision: string) {
    return await this.client.get(id, {
      rev: revision
    })
  }

  setOffline() {
    this.emit('offline')
    this.online = true
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
