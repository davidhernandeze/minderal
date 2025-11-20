import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'

export default class extends Widget {
  key = 'text'
  expandedComponent: string = 'TextExpanded'
  previewComponent: string = 'TextPreview'
  showMainInput: boolean = true
  doc: WidgetDocStructure

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getContent(): string {
    return <string>this.doc.content
  }
}
