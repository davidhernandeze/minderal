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
      fields: [{ name: 'content', type: 'text' }]
    }
  }

  updateDocFromForm(form: { name: string; content: string }): void {
    super.updateDocFromForm(form)
    this.doc.content = form.content
    this.doc.name = form.name ?? null
  }

  getContent(): string {
    return <string>this.doc.content
  }
}
