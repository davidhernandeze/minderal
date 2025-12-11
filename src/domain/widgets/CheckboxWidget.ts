import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export default class extends Widget {
  key = 'checkbox'
  label: string = 'Checkbox'
  saved: boolean = false
  expandable: boolean = true
  previewComponent: string = 'CheckboxPreview'
  standalonePreview: boolean = false

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'content', type: 'checkbox', label: 'Checked' }
      ]
    }
  }

  getContent() {
    return !!this.doc.content
  }

  updateDocFromForm(form): void {
    this.doc.name = form.name
    this.doc.content = form.content
  }
}
