import { Core, type CoreContext } from './Core.js'

export class BrowserCore extends Core {
  readonly runtime: 'browser' = 'browser'

  private constructor(context: CoreContext) {
    super(context)
  }

  static create(context: CoreContext): BrowserCore {
    return new BrowserCore(context)
  }
}
