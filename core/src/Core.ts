import { detectRuntime, type Runtime } from './Runtime.js'

export class Core {
  static readonly instance: Core = new Core()

  private constructor() {}

  async init(): Promise<Runtime> {
    return detectRuntime()
  }
}
