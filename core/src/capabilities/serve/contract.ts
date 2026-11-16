import { defineCapability, type Implementation } from '../Capability.js'

export interface ServeOptions {
  readonly port?: number
  readonly host?: string
  readonly publicUrl?: string
}

export type ServeArgs = readonly [options: ServeOptions]

export type ServeImplementation = Implementation<ServeArgs, string>

export const serveCapability = defineCapability<ServeArgs, string>('serve')
