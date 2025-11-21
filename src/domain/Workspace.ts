import { v4 as generateId } from 'uuid'
import { Database } from '@/domain/Database'
import { Widget } from '@/domain/Widget'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { EventEmitter } from 'events'
import { staticWidgetTypes, WidgetTypeDefinition } from '@/domain/widgets'

export class Workspace extends EventEmitter {
  id: string
  db: Database
  docId: string = ''
  expandedWidget: Widget
  loading: boolean = false
  widgetTypes: Map<string, WidgetTypeDefinition> = new Map()

  widgetFactory: WidgetFactory
  widgetOnEdit: Widget | null = null

  constructor(db: Database, docId: string) {
    super()
    this.id = generateId()
    this.db = db
    this.docId = docId
    this.widgetFactory = new WidgetFactory(this, db)
    this.loadWidgetTypes()
  }

  async loadMainWidget(): Promise<void> {
    this.expandedWidget = await this.widgetFactory.getOrCreateFromDoc({
      _id: 'root',
      name: 'home',
      content: null,
      widget: 'folder'
    })
    this.emit('expandedWidget:changed', this.expandedWidget)
  }

  loadWidgetTypes() {
    for (const widgetType of staticWidgetTypes) {
      this.widgetTypes.set(widgetType.key, widgetType)
    }
    this.emit('widgetTypes:changed')
  }

  getWidgetTypes(): WidgetTypeDefinition[] {
    return Array.from(this.widgetTypes.values())
  }

  getWidgetTypeDefinition(key: string): WidgetTypeDefinition {
    return this.widgetTypes.get(key)
  }
}
