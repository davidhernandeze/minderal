import { v4 as generateId } from 'uuid'
import { Database } from '@/domain/Database'
import { Widget } from '@/domain/Widget'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { EventEmitter } from 'events'

export class Workspace extends EventEmitter {
  id: string
  db: Database
  docId: string = ''
  expandedWidget: Widget
  loading: boolean = false
  widgetFactory: WidgetFactory

  constructor(db: Database, docId: string) {
    super()
    this.id = generateId()
    this.db = db
    this.docId = docId
    this.widgetFactory = new WidgetFactory(db)
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
}
