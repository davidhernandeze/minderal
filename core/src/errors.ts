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

/** One node tried while delegating a capability, and why it could not take the request. */
export interface DelegationAttempt {
  readonly nodeId: string
  readonly reason: string
}

export class CapabilityUnavailableError extends CoreError {
  readonly capability: string
  /** The nodes that announce the capability but could not be reached or refused, in the order tried. */
  readonly attempts: readonly DelegationAttempt[]

  constructor(capability: string, attempts: readonly DelegationAttempt[] = []) {
    super(
      attempts.length === 0
        ? `No core in the cluster can perform ${capability}`
        : `No core in the cluster could perform ${capability}: ${attempts.map((attempt) => `${attempt.nodeId} ${attempt.reason}`).join('; ')}`,
    )
    this.capability = capability
    this.attempts = attempts
  }
}

/**
 * A node accepted a delegated request, then failed without a result the capability's contract describes:
 * it crashed, went away before answering, or answered something unreadable. The capability may have run.
 */
export class DelegationError extends CoreError {
  readonly capability: string
  readonly nodeId: string

  constructor(capability: string, nodeId: string, reason: string, cause?: unknown) {
    super(`Node ${nodeId} failed to perform ${capability}: ${reason}`, { cause })
    this.capability = capability
    this.nodeId = nodeId
  }
}

/**
 * A delegated result started arriving and was cut short: the node went away or failed mid-stream.
 * Raised where the rest of the result is read — for `fetch`, while reading the response body.
 */
export class PartialResultError extends CoreError {
  readonly capability: string
  readonly nodeId: string
  /** Bytes of the result received before it was cut. */
  readonly receivedBytes: number

  constructor(capability: string, nodeId: string, receivedBytes: number, cause?: unknown) {
    super(`The result of ${capability} from node ${nodeId} was cut short after ${receivedBytes} bytes`, { cause })
    this.capability = capability
    this.nodeId = nodeId
    this.receivedBytes = receivedBytes
  }
}

/** A cluster endpoint refused or did not understand a cluster request: joining, announcing. */
export class ClusterError extends CoreError {
  readonly endpoint: string

  constructor(endpoint: string, reason: string, cause?: unknown) {
    super(`Cluster endpoint ${endpoint} ${reason}`, { cause })
    this.endpoint = endpoint
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

export class DocumentConflictError extends CoreError {
  readonly datasetId: string
  readonly documentId: string

  constructor(datasetId: string, documentId: string) {
    super(`Document ${documentId} in dataset ${datasetId} changed since the revision given; read it again and retry`)
    this.datasetId = datasetId
    this.documentId = documentId
  }
}
