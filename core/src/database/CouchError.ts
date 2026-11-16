/** An error answered the CouchDB way: an HTTP status, an error name and a reason. */
export class CouchError extends Error {
  readonly status: number
  readonly error: string

  constructor(status: number, error: string, reason: string) {
    super(reason)
    this.status = status
    this.error = error
  }
}
