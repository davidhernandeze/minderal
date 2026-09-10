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
  unextendable. Concrete classes use a `private` constructor plus a `static create`.
  Nothing is constructible from outside because subclasses are exported from `index.ts`
  as **types only**.
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
