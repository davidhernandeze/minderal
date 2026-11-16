import type { Runtime } from '../Runtime.js'
import type { Platform } from './Platform.js'

export async function loadPlatform(runtime: Runtime): Promise<Platform> {
  switch (runtime) {
    case 'nodejs':
      return (await import('./nodejs.js')).nodejsPlatform
    case 'browser':
      return (await import('./browser.js')).browserPlatform
  }
}
