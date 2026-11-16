export interface Capability<Args extends readonly unknown[], Result> {
  readonly id: string
  readonly signature?: (...args: Args) => Promise<Result>
}

export type Implementation<Args extends readonly unknown[], Result> = (...args: Args) => Promise<Result>

export function defineCapability<Args extends readonly unknown[], Result>(id: string): Capability<Args, Result> {
  return { id }
}
