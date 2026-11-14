import { BrowserCore } from './BrowserCore.js'
import type { Core } from './Core.js'
import { detectRuntime, type Runtime } from './Runtime.js'
import { ServerCore } from './ServerCore.js'

export function getCoreForCurrentRuntime(): Core {
  return createCoreFor(detectRuntime())
}

export function createCoreFor(runtime: Runtime): Core {
  switch (runtime) {
    case 'browser':
      return BrowserCore.create()
    case 'node':
      return ServerCore.create()
  }
}
