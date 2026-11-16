export class CoreError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
  }
}

export class UnsupportedRuntimeError extends CoreError {
  constructor() {
    super('Minderal core could not identify the runtime: expected Node.js or a browser')
  }
}

export class CapabilityUnavailableError extends CoreError {
  readonly capability: string

  constructor(capability: string) {
    super(`No core in the cluster can perform ${capability}`)
    this.capability = capability
  }
}

export class NetworkError extends CoreError {
  readonly url: string

  constructor(url: string, cause: unknown) {
    super(`Network request to ${url} failed`, { cause })
    this.url = url
  }
}

export class DatasetNotFoundError extends CoreError {
  readonly datasetId: string

  constructor(datasetId: string) {
    super(`Dataset ${datasetId} is not known on this runtime`)
    this.datasetId = datasetId
  }
}

export class StorageError extends CoreError {
  readonly datasetId: string

  constructor(datasetId: string, action: string, cause: unknown) {
    super(`Storage of dataset ${datasetId} failed to ${action}`, { cause })
    this.datasetId = datasetId
  }
}

export class CoreClosedError extends CoreError {
  readonly datasetId: string

  constructor(datasetId: string) {
    super(`The core for dataset ${datasetId} is closed`)
    this.datasetId = datasetId
  }
}
