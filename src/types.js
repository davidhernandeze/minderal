export class Doc {
  // eslint-disable-next-line camelcase
  constructor ({ _id, parent_id, index_value, order, _rev, name, value, type, created_by, created_at, settings }) {
    this._id = _id
    // eslint-disable-next-line camelcase
    this.parent_id = parent_id
    this.name = name
    this.value = value
    this.type = type
    this._rev = _rev
    // eslint-disable-next-line camelcase
    this.index_value = index_value
    this.order = order
    // eslint-disable-next-line camelcase
    this.created_by = created_by
    // eslint-disable-next-line camelcase
    this.created_at = created_at
    this.settings = settings
  }
}
