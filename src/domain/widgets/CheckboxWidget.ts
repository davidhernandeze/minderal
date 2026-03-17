import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export default class extends Widget {
  readonly key = 'checkbox'
  readonly label: string = 'Checkbox'
  readonly expandedComponent: string = 'CheckboxExpanded'
  readonly previewComponent: string = 'CheckboxPreview'
  readonly standalonePreview: boolean = true
  readonly hideIcon: boolean = true
  doc: WidgetDocStructure

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getFormStructure(): FormStructure {
    return {
      fields: [{ name: 'name', type: 'text' }]
    }
  }

  updateDocFromForm(form: { name: string }): void {
    this.doc.name = form.name
  }

  getContent(): boolean {
    return <boolean>this.doc.content
  }
}
