import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'

export default class extends Widget {
  readonly key = 'text'
  readonly expandedComponent: string = 'TextExpanded'
  readonly previewComponent: string = 'TextPreview'
  static readonly formComponent: string = 'GeneralForm'
  showMainInput: boolean = true
  doc: WidgetDocStructure

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  static getFormStructure() {
    const formStructure: object = super.getFormStructure()
    formStructure.content = { type: 'textarea', label: 'Content', required: true }
    return formStructure
  }

  getContent(): string {
    return <string>this.doc.content
  }
}
