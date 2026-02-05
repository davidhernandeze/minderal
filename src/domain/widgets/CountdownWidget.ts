import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export type CountdownContent = {
  year: number | null
  month: number | null // 0-based month, like moment.js
  day: number | null
  time: string | null // 'HH:mm' format or null
  offset?: number | null
}

export default class extends Widget {
  readonly key = 'countdown'
  readonly label: string = 'Countdown'
  readonly previewComponent: string = 'Countdown'
  readonly icon: string = 'bi bi-hourglass'
  readonly expandable: boolean = false
  readonly standalonePreview: boolean = false

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', label: 'Name' },
        { name: 'year', type: 'number', label: 'Year' },
        { name: 'month', type: 'number', label: 'Month (0-11)' },
        { name: 'day', type: 'number', label: 'Day (1-31)' },
        { name: 'time', type: 'text', label: "Time (HH:mm)" }
      ]
    }
  }

  updateDocFromForm(form: { name: string; year?: number; month?: number; day?: number; time?: string }): void {
    this.doc.name = form.name
    const prev = (this.doc.content as unknown as Partial<CountdownContent>) || {}
    const content: CountdownContent = {
      year: typeof form.year === 'number' ? form.year : null,
      month: typeof form.month === 'number' ? form.month : null,
      day: typeof form.day === 'number' ? form.day : null,
      time: typeof form.time === 'string' && form.time ? form.time : null,
      offset: typeof prev.offset === 'number' ? prev.offset : null
    }
    this.doc.content = content
  }

  getContent(): CountdownContent {
    const c = (this.doc.content as unknown as CountdownContent) || {}
    return {
      year: typeof c.year === 'number' ? c.year : null,
      month: typeof c.month === 'number' ? c.month : null,
      day: typeof c.day === 'number' ? c.day : null,
      time: typeof c.time === 'string' ? c.time : null,
      offset: typeof c.offset === 'number' ? c.offset : null
    }
  }
}
