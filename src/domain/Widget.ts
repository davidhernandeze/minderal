import { Database } from '@/domain/Database'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { EventEmitter } from 'events'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export type WidgetRoute = { _id: string; name: string; widget: string }[]

export abstract class Widget extends EventEmitter {
  name: string
  key: string
  saved: boolean = false
  route: WidgetRoute = []
  children: Map<string, Widget> = new Map()
  doc: WidgetDocStructure
  docId: string = ''
  readonly showMainInput: boolean
  readonly icon: string
  readonly expandable: boolean = false
  readonly standalonePreview: boolean = false
  readonly expandedComponent?: string
  readonly previewComponent?: string
  readonly formComponent?: string = 'GeneralForm'
  readonly hideCopyButton: boolean = false
  static readonly formComponent: string
  private readonly db: Database
  private readonly widgetFactory: WidgetFactory

  abstract label: string

  protected constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super()
    this.db = db
    this.docId = doc._id
    this.doc = doc
    this.widgetFactory = widgetFactory
    if (doc.created_at) this.saved = true
  }

  abstract getFormStructure(): FormStructure

  abstract updateDocFromForm(form: object): void

  listenForChanges() {
    this.db.on(`doc:changed:${this.docId}`, async (doc) => {
      if (doc._id === this.doc._id && doc._rev !== this.doc._rev) {
        this.updateDoc(doc)
      }
    })
    this.db.on(`child:changed:${this.docId}`, async (doc) => {
      const childWidget = await this.widgetFactory.fromDoc(doc)
      childWidget.listenForChanges()
      this.children.set(doc._id, childWidget)
      this.emit('children:changed')
    })
  }

  async save() {
    await this.db.createDoc(this.doc)
    this.saved = true
  }

  updateDoc(doc: WidgetDocStructure) {
    this.doc = doc
    this.name = doc.name
    this.emit('content:changed')
    this.emit('name:changed')
  }

  async fetchRoute() {
    return this.route
  }

  getChildren() {
    return Array.from(this.children.values())
  }

  getContent() {
    return this.doc.content
  }

  getName() {
    return this.name
  }

  async fetchChildren() {
    const childDocs = await this.db.getDocsByParentId(this.doc._id)
    for (const childDoc of childDocs) {
      const childWidget = await this.widgetFactory.fromDoc(childDoc)
      childWidget.listenForChanges()
      this.children.set(childDoc._id, childWidget)
    }
    this.emit('children:changed')
  }

  async rename(name: string) {
    this.doc.name = name
    await this.db.updateDoc(this.doc)
    this.emit('name:changed')
  }

  async updateContent(content: string) {
    this.doc.content = content
    await this.db.updateDoc(this.doc)
  }

  getPastableContent(): string {
    return <string>this.doc.content
  }
}
