# AGENTS.md — @minderal/core

Core library for a new data ingest model. Built from scratch. Ignore `../minderal-app`;
it is the old implementation and is not a reference.

## Workflow — follow this order for every feature

1. **Implement.** Change the TypeScript library under `./src/`.
2. **Test.** Add unit tests under `./tests/` covering the feature.

Build what was asked for, not more.

## Code rules

`./src/` — the library:
- **No comments.** None. Not even JSDoc.
- Clarity comes from descriptive names and explicit types instead.
- Named exports only; every public symbol is re-exported from `src/index.ts`.
- `strict` TypeScript. No `any`, no non-null `!` assertions, no `as` casts to escape a type error.
- Pure and side-effect free unless the feature is inherently about I/O.
- **One class per file**, named after the class. Helper functions live with the single
  class that uses them; a helper shared by two classes gets its own module.
- Abstract bases use a `protected` constructor, not `private` — `private` makes the class
  unextendable. Concrete classes use a `private` constructor plus a `static create` — or a
  better verb where `create` would collide with an instance method (`Database.open`).
  Nothing is constructible from outside because subclasses are exported from `index.ts`
  as **types only**.
- **`async`/`await`, never callbacks or promise chains.** No `.then()`/`.catch()`, and no
  higher-order helpers that take an async callback to wrap control flow — use `try`/`catch`
  in the method itself. A helper that needs to decorate an error should *return* the error
  so the caller writes `throw this.failure(...)`. Array methods (`map`, `filter`, `sort`)
  are not what this rule is about; a function passed to a third-party API that demands one
  (PouchDB's `fetch` option) is fine.
- **Every `Database` operation awaits `initialize()` first.** It is memoized per handle, so
  it runs once: it creates the Mango indexes the queries need and applies migrations.
  New indexes and migrations go there, not inline in the query that needs them.
- **PouchDB and CouchDB do not agree on Mango `null`.** `{field: null}` matches a *missing*
  field on PouchDB's adapters but only an explicit `null` on CouchDB. A unit test on the
  memory adapter will therefore pass while the remote silently returns nothing. Every
  document a Mango selector filters on must carry the field — `toDocument()` always writes
  `deleted_at` for exactly this reason — and any new selector needs an integration test.
- **`find()` returns 25 documents when given no limit** — on PouchDB's adapters and on
  CouchDB alike. Every Mango query pages explicitly through `findAll`; a bare `find()`
  silently truncates and the tests pass anyway unless one of them crosses 25 rows.
- **PouchDB clients are long-lived.** One client per `Database`, opened lazily and kept
  for the handle's lifetime; `Connection` caches its `Database` handles by name so one
  name means one client. Do not go back to a client per operation — `close()` tears down
  the store shared by every client on that database name, so closing one while another
  has work in flight deadlocks with no error. Closing is safe and reversible: a closed
  handle opens a fresh client on next use. There is no rule against `changes()` or
  `sync()`; the sync system is still to be designed.
- **A base class must never import its subclasses.** `class X extends Base` runs at
  module-evaluation time, so a base that constructs its own subclasses forms a cycle and
  throws a TDZ `ReferenceError` depending on which module loads first. Put construction
  in a separate factory class that imports the subclasses — nothing imports the factory
  back, so the graph stays acyclic. See `ConnectionFactory.ts`.
  Verify with `npm run build && grep import dist/<Base>.js`: the base must not import
  any subclass.

`./tests/` — the tests, in two layers:
- Comments are welcome, especially to explain what behavior is being pinned down.
- Import whatever module the test needs, `../src/index.js` or an internal one.
- **Unit** — `tests/<feature>.test.ts`, one file per feature. No network, no Docker,
  no disk: stub `fetch`, use PouchDB's `memory` adapter. This is what `npm test` runs
  and what must stay fast and always green.
- **Integration** — `tests/integration/<subject>.test.ts`, run by `npm run test:integration`
  against the real CouchDB in `compose.yaml`. Kept out of `npm test` on purpose.
  Write one whenever a unit test can only assert an *assumption about an external
  system* — a wire format, a header name, a status code. The stub proves the code does
  what we think; the integration test proves what we think is true.

## Commands

```
npm install             # once
npm test                # unit tests only — fast, no Docker
npm run test:watch      # unit tests, watching
npm run typecheck       # tsc --noEmit
npm run build           # emit dist/

npm run couchdb:up      # start CouchDB (compose.yaml), waits until healthy
npm run test:integration
npm run couchdb:down    # stop it and drop the volume
```

CouchDB runs on `localhost:5984` as `admin`/`password`, with its data in tmpfs so every
`up` starts clean. Override with `COUCHDB_URL`, `COUCHDB_USER`, `COUCHDB_PASSWORD`.

## Layout

```
core/
  src/                  library source (no comments), one class per file
    index.ts            public surface
    Connection.ts       abstract base, imports nothing
    ConnectionError.ts
    ConnectionFactory.ts  the only way to construct a connection
    LocalConnection.ts
    RemoteConnection.ts
    Database.ts         one database handle, document operations
    Neuron.ts           abstract base, shared fields and their mapping
    NeuronError.ts
    NeuronFactory.ts    document type -> neuron class
    StringNeuron.ts
    types/              ambient declarations for untyped dependencies
  tests/                unit tests, one file per feature
    integration/        tests that need the real CouchDB
  compose.yaml          CouchDB for the integration tests
```

## Definition of done for a feature

- [ ] Implemented in `src/`, exported from `src/index.ts`
- [ ] Unit tests in `tests/` pass (`npm test`)
- [ ] An integration test too, if the feature talks to an external system
- [ ] `npm run typecheck` is clean
