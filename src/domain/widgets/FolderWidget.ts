import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'

export default class extends Widget {
  key = 'folder'
  expandable: boolean = true
  expandedComponent: string = 'FolderExpanded'
  showMainInput: boolean = true

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
    void this.fetchChildren()
  }
}
