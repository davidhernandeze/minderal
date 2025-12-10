import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export default class extends Widget {
  readonly key = 'text'
  readonly label: string = 'Text'
  readonly expandedComponent: string = 'TextExpanded'
  readonly previewComponent: string = 'TextPreview'
  static readonly formComponent: string = 'GeneralForm'
  showMainInput: boolean = true
  doc: WidgetDocStructure

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', label: 'Name' },
        { name: 'content', type: 'textarea', label: 'Content' }
      ]
    }
  }

  updateDocFromForm(form): void {
    this.doc.name = form.name
    this.doc.content = form.content
  }

  getContent(): string {
    return <string>this.doc.content
  }
}
