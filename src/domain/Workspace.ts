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
  widgetTypes: Map<string, WidgetTypeDefinition> = new Map()

  widgetFactory: WidgetFactory

  constructor(db: Database, docId: string) {
    super()
    this.id = generateId()
    this.db = db
    this.docId = docId
    this.widgetFactory = new WidgetFactory(this, db)
    this.loadWidgetTypes()
  }

  async navigateToWidget(widgetId = 'root'): Promise<void> {
    this.docId = widgetId
    this.expandedWidget?.removeListeners()
    this.expandedWidget = await this.widgetFactory.getFromId(widgetId)
    this.expandedWidget.listenForChanges()
    await this.expandedWidget.fetchChildren()
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
}
