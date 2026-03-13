import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export default class extends Widget {
  readonly key = 'color'
  readonly label = 'Color'
  readonly previewComponent = 'ColorPreview'

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', label: 'Name' },
        { name: 'content', type: 'color', label: 'Color', default: '#6366f1' }
      ]
    }
  }

  updateDocFromForm(form: { content: string }): void {
    this.doc.content = form.content
  }

  getContent(): string {
    return (this.doc.content as string) || '#6366f1'
  }
}
