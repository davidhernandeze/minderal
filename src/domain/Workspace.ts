import { v4 as generateId } from 'uuid'
import { Database } from '@/domain/Database'
import { Widget } from '@/domain/Widget'
import { WidgetFactory } from '@/domain/WidgetFactory'

export class Workspace {
  id: string
  db: Database
  docId: string = ''
  expandedWidget: Widget
  loading: boolean = false
  widgetFactory: WidgetFactory

  constructor(db: Database, docId: string = '') {
    this.id = generateId()
    this.db = db
    this.docId = docId
    this.widgetFactory = new WidgetFactory(db)
  }

  async loadMainWidget(docId: string | null = null) {
    if (!docId) {
      this.expandedWidget = await this.widgetFactory.getOrCreateFromDoc({
        _id: 'root',
        content: null,
        widget: ''
      })
    } else {
      this.expandedWidget = await this.widgetFactory.getFromId(docId)
    }
  }
}
