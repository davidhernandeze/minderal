export interface WidgetRequest {
  _id: string
  name?: string
  parent_id?: string
  content: string
  widget: string
  settings?: object
  files?: object[]
}
