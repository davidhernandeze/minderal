import { Core } from './Core.js'

export class BrowserCore extends Core {
  readonly runtime: 'browser' = 'browser'

  private constructor() {
    super()
  }

  static create(): BrowserCore {
    return new BrowserCore()
  }
}
