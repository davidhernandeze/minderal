import { Core as CoreClass } from './Core.js'

export const Core: CoreClass = CoreClass.instance
export type Core = CoreClass
export { UnsupportedRuntimeError, type Runtime } from './Runtime.js'
