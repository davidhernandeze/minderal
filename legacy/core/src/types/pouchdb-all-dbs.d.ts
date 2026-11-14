declare module 'pouchdb-all-dbs' {
  export interface AllDbsCapability {
    allDbs(): Promise<string[]>
  }

  export default function registerAllDbs<PouchConstructor extends object>(
    pouchConstructor: PouchConstructor
  ): asserts pouchConstructor is PouchConstructor & AllDbsCapability
}
