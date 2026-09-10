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
  filter: string = ''
  typesLoadedPromise: Promise<void>

  widgetFactory: WidgetFactory

  constructor(db: Database, docId: string) {
    super()
    this.id = generateId()
    this.db = db
    this.docId = docId
    this.widgetFactory = new WidgetFactory(this, db)
    this.typesLoadedPromise = this.loadWidgetTypes()
  }

  async navigateToWidget(widgetId = 'root'): Promise<void> {
    await this.typesLoadedPromise
    this.filter = ''
    this.docId = widgetId
    this.expandedWidget?.removeListeners()
    this.expandedWidget = await this.widgetFactory.getFromId(widgetId)
    this.expandedWidget.listenForChanges()
    await this.expandedWidget.fetchChildren()
    await this.expandedWidget.fetchRoute()
    this.emit('expandedWidget:changed', this.expandedWidget)
  }

  async loadWidgetTypes() {
    this.widgetTypes.clear()
    for (const widgetType of staticWidgetTypes) {
      this.widgetTypes.set(widgetType.key, widgetType)
    }

    try {
      const customTypeDocs = await this.db.getWidgetTypeDocs()
      for (const doc of customTypeDocs) {
        const primitiveType = this.widgetTypes.get(doc.primitive)
        if (!primitiveType) continue

        this.widgetTypes.set(doc._id, {
          key: doc._id,
          label: doc.label,
          icon: doc.icon ? `bi bi-${doc.icon}` : primitiveType.icon,
          showNameSelector: primitiveType.showNameSelector,
          isCustom: true,
          class: primitiveType.class,
          parentable: primitiveType.parentable
        })
      }
    } catch {
      // DB may not be ready yet — static types are still available
    }

    this.emit('widgetTypes:changed')
  }

  async reloadWidgetTypes() {
    this.typesLoadedPromise = this.loadWidgetTypes()
    await this.typesLoadedPromise
  }

  getWidgetTypes(): WidgetTypeDefinition[] {
    return Array.from(this.widgetTypes.values())
  }

  setFilter(filter: string) {
    this.filter = filter
    this.expandedWidget?.filter()
  }
}
