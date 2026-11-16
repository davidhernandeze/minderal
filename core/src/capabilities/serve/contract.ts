import { defineCapability, type Implementation } from '../Capability.js'

export interface ServeOptions {
  readonly port?: number
  readonly host?: string
  readonly publicUrl?: string
  /**
   * Browser origins allowed to reach this endpoint, e.g. `http://localhost:5173`, or `*` for any.
   * Defaults to none: any web page a user visits could otherwise read a dataset served on localhost.
   */
  readonly origins?: readonly string[]
}

export type ServeArgs = readonly [options: ServeOptions]

export type ServeImplementation = Implementation<ServeArgs, string>

export const serveCapability = defineCapability<ServeArgs, string>({
  name: 'serve',
  version: 1,
  contract: {
    args: ['options: { port?: number, host?: string, publicUrl?: string, origins?: string[] }'],
    result: 'the endpoint URL other nodes use to reach this dataset',
  },
})
