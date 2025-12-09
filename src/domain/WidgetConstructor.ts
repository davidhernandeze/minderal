import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Widget } from '@/domain/Widget'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { Database } from '@/domain/Database'
import { Form } from '@/domain/interfaces/Form'

export default interface WidgetConstructor {
  new (db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory): Widget
}
