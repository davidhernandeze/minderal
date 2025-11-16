import { Database } from '@/domain/Database'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { EventEmitter } from 'events'

export type WidgetRoute = { _id: string; name: string; widget: string }[]

export class Widget extends EventEmitter {
  name: string
  showMainInput: boolean
  expandable: boolean = false
  route: WidgetRoute = []
  children: Map<string, Widget> = new Map()
  standalonePreview: boolean = false
  hideCopyButton: boolean = false
  formComponent?: string
  private db: Database
  private doc: WidgetDocStructure
  private widgetFactory: WidgetFactory

  constructor(db: Database, doc: WidgetDocStructure) {
    super()
    this.db = db
    this.doc = doc
    this.name = doc.name
    void this.fetchRoute()
    this.widgetFactory = new WidgetFactory(db)
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

  async fetchChildren() {
    console.log(this.doc._id)
    const childDocs = await this.db.getDocsByParentId(this.doc._id)
    console.log(childDocs)
    for (const childDoc of childDocs) {
      const childWidget = await this.widgetFactory.fromDoc(childDoc)
      this.children.set(childDoc._id, childWidget)
    }
    this.emit('children:changed')
  }
}
