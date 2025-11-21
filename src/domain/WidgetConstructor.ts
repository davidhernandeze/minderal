import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Widget } from '@/domain/Widget'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { Database } from '@/domain/Database'

export default interface WidgetConstructor {
  new (db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory): Widget
  formComponent?: string
}
