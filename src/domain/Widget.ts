import { Database } from '@/domain/Database'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { EventEmitter } from 'events'
import { WidgetFactory } from '@/domain/WidgetFactory'

export type WidgetRoute = { _id: string; name: string; widget: string }[]

export class Widget extends EventEmitter {
  name: string
  key: string
  route: WidgetRoute = []
  children: Map<string, Widget> = new Map()
  doc: WidgetDocStructure
  readonly showMainInput: boolean
  readonly icon: string
  readonly expandable: boolean = false
  readonly standalonePreview: boolean = false
  readonly expandedComponent?: string
  readonly previewComponent?: string
  readonly hideCopyButton: boolean = false
  readonly formComponent?: string
  private readonly db: Database
  private widgetFactory: WidgetFactory

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super()
    this.db = db
    this.updateDoc(doc)
    void this.fetchRoute()
    this.widgetFactory = widgetFactory
  }

  listenForChanges() {
    this.db.on('doc:changed', async ({ doc }) => {
      if (doc._id === this.doc._id && doc._rev !== this.doc._rev) {
        this.updateDoc(doc)
      }
    })
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
