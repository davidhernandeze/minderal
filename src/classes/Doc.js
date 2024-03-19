export class Doc {
  constructor (data) {
    this._id = data._id
    this._rev = data._rev
    this.parent_id = data.parent_id
    this.name = data.name
    this.content = data.content
    this.widget = data.widget
    this.order = data.order
    this.created_by = data.created_by
    this.created_at = data.created_at
    this.updated_at = data.updated_at
    this.deleted_at = data.deleted_at || null
  }
}
