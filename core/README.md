# @minderal/core

The core library: one TypeScript package that owns the whole lifecycle of a Minderal
database. Rewritten from scratch for v5.

Everything before this is in `../legacy/`. It is reference material only — read it for
ideas and for problems already solved, never import from it, never copy a file wholesale.

## Why a rewrite

Four previous attempts (`legacy/core`, `legacy/app`, `legacy/minderal-app`, `legacy/pipe`)
each proved parts of the model and each ran into the same wall: the architecture grew out
of the features instead of holding them. v5 starts from the architecture.

## What this package is

A document database manager. A database follows strict, self-describing standards that
define both its data and its functionality, and the library enforces them in every
environment it runs in.

Vocabulary that survived the journey and stays:

- **neuron** — the indivisible unit of data, stored as JSON, created from a template.
- **template** — a neuron blueprint; instructs how neurons of that template behave.
  A template is itself a neuron (`{ _id: "template", implements: "neuron" }`), so the
  system is defined under its own rules.
- **definition** — an extensible structure; types are template, rule and function.
  Built-in definitions ship with the library and can only be added by developers;
  extended definitions live in the database.
- **relation** — where data actually lives, declared on templates and held on neurons
  under `has: {}`, keyed by the related document id.
- **widget** — a group of related neurons sharing information and functionality.
- **catalog** — definitions grouped by type.

## Foundations, decided

- **TypeScript, strict.** The only sane choice for a typed, self-describing system, and
  the most portable runtime target: Node for server mode, browsers, Capacitor for mobile,
  Tauri sidecar for desktop.
- **Two abstraction layers, explicit from day one.**
  - *Database access*: a database can live under different engines — CouchDB (self
    hosted), LevelDB (standalone desktop), IndexedDB (browser).
  - *Feature access*: capabilities depend on the environment. The library falls back to a
    replacement capability where one exists and fails gracefully, with a clear error,
    where none does. Topology influences capabilities of the system as a whole.
- **Portability is a test obligation, not an intention.** Anything that must behave the
  same on two runtimes gets one implementation and one shared suite of cases that both
  runtimes run.

## Open, to be designed before code

- The shape of the two abstraction layers, and whether PouchDB stays as the normalizing
  layer under database access or is replaced by a thinner internal contract.
- Change feeds, replication and conflict resolution across engines.
- Fresh initialization: what the library writes when it boots into an empty environment.
- Identity, authentication and the free/paid broker topology.
- The grid layout calculator (spec in `legacy/plan_for_refactor.md`) — shared logic here,
  thin renderers per platform.

## Hard-won rules carried over

From `legacy/core/AGENTS.md`, kept because each one cost real debugging:

- PouchDB and CouchDB disagree on Mango `null`: `{field: null}` matches a *missing* field
  on PouchDB adapters but only an explicit `null` on CouchDB. Every field a selector
  filters on must always be written, and every new selector needs an integration test
  against a real CouchDB.
- A CouchDB session is dated from the newest cookie, not from login — a client replaying
  the login cookie expires at `couch_httpd_auth.timeout` however busy it is.
- Document ids carry their type as a prefix (`neuron:<uuid>`), so id ranges act as an
  index and foreign documents in the same database stay out of the factories.

## Usage

```ts
import { createDataset, openDataset } from '@minderal/core'

const core = await createDataset()                       // new dataset in this runtime's local storage
const again = await openDataset(core.datasetId)          // a dataset this runtime already knows
const remote = await createDataset({                     // a dataset stored in a CouchDB server
  storage: { engine: 'couchdb', url: 'https://couch.example' },
  credentials: { username, password },
})

core.datasetId        // uuid of the dataset
core.nodeId           // uuid of this core as a node of the dataset's cluster
core.cluster.nodes    // [{ id, runtime: 'nodejs' | 'browser', role: 'orchestrator' | 'member' }]
await core.close()
```

A core does one job: give access to one dataset. It is created by `createDataset` or
`openDataset`, never directly, and callers only see the abstract `Core` type —
`ServerCore` (Node.js) and `BrowserCore` stay internal. Several cores can run side by
side, including several on the same dataset.

## Datasets

A dataset is a CouchDB-compatible database, accessed through PouchDB.

| storage | runtime | where |
| --- | --- | --- |
| `{ engine: 'local' }` (default) | Node.js | LevelDB under `<home>/datasets/<id>` |
| `{ engine: 'local' }` (default) | browser | IndexedDB, named `<home>/datasets/<id>` |
| `{ engine: 'couchdb', url }` | both | database `minderal-<id>` on that server |

A CouchDB server still counts as *local* storage for the core using it: local means the
core reads and writes the storage itself. Client mode — a core with no storage, using
the cluster's — comes later.

**Registry.** Each runtime keeps a registry of the datasets it knows, so `openDataset(id)`
knows how to reach a dataset. It lives in `<home>/registry`. The default home is
`MINDERAL_HOME` or `~/.minderal` on Node.js, and `minderal` in a browser; every function
accepts `{ home }` to use another one. The registry never stores credentials: pass
`{ credentials }` when opening, or set `MINDERAL_COUCHDB_USERNAME` and
`MINDERAL_COUCHDB_PASSWORD` on Node.js.

**Cluster document.** Every dataset holds a `_design/cluster` document, written when it
is created, with the founding core as its only node:

```json
{ "_id": "_design/cluster", "dataset": "<id>", "nodes": [{ "id": "<node>", "runtime": "nodejs", "role": "orchestrator" }], "endpoints": [] }
```

A Node.js core founds a dataset as its `orchestrator`; a browser core founds it as its
only `member`, with no cluster capabilities. Opening a dataset reads this document into
`core.cluster`. Cluster endpoints, joining and sync come in the next steps.

Errors: `DatasetNotFoundError` when the registry does not know the id, `StorageError` when
the storage cannot be reached, rejects the credentials, or holds no valid cluster
document, `CoreClosedError` when a closed core is used.

## Capabilities

A capability is a method on `Core` — `core.fetch(...)` — never a string key. Callers get
exactly one of two outcomes: the result, or a typed exception. Where the work ran is
invisible to them.

```
core.fetch(url)
  ├─ the core implements it locally  → runs it          (ServerCore: Node's fetch)
  └─ it does not                     → asks its cluster for a core that can
                                       → none: CapabilityUnavailableError
```

Error contract, the same on every core:

| outcome | when |
| --- | --- |
| result | the capability ran — for `fetch`, any HTTP status, 404 and 500 included |
| `TypeError` | invalid arguments, checked before routing (a malformed or non-http URL) |
| `CapabilityUnavailableError` | neither this core nor any core in its cluster can perform it |
| `NetworkError` | a core performed it and the network failed; `cause` holds the original |

Every library error extends `CoreError`.

Adding a capability:

1. `src/capabilities/<name>/contract.ts` — argument and result types, the capability
   definition, argument validation.
2. `src/capabilities/<name>/<runtime>.ts` — a local implementation for each core that can
   perform it.
3. `src/capabilities/LocalCapabilities.ts` — one optional field.
4. `src/Core.ts` — one public method that calls `perform(...)`.
5. The core classes that implement it list it in their `local` capabilities.

The type checker holds the pieces together: a local implementation must match the
capability's signature.

Status: the cluster has no nodes yet, so a capability a core cannot run locally always
throws `CapabilityUnavailableError`. Forwarding to other cores is the next step.

## Development

Every step lands with tests that run end to end on every supported runtime.

```sh
npm install
npm run setup:browsers   # once: downloads Playwright's Chromium
npm run verify           # typecheck + every test incl. CouchDB + e2e tests on the built dist
```

`verify` and `test:couchdb` need Docker running: they start a CouchDB 3.4 container
(`compose.yaml`, port 15984, compose project `minderal-core-test`) and leave it running for
fast reruns. `npm run couchdb:down` removes it.

| script | what it does |
| --- | --- |
| `npm test` | every suite, once in Node and once in headless Chromium |
| `npm run test:nodejs` / `test:browser` | one runtime only |
| `npm run test:watch` | watch mode, both runtimes |
| `npm run test:couchdb` | starts the CouchDB container, then every suite including `*.couchdb.test.ts` |
| `npm run test:dist` | builds, then runs `tests/e2e` against `dist/` — the shipped artifact |
| `npm run typecheck` | `tsc` over src, tests and config |

Tests:

- `tests/e2e/` — black-box, public API only, imported as `@minderal/core`. Runs against
  `src/` by default and against `dist/` under `test:dist`.
- `tests/unit/` — white-box tests of internals, imported from `src/` directly.
- `*.couchdb.test.ts` — need a CouchDB; skipped unless `MINDERAL_TEST_COUCHDB_URL` is set,
  which `test:couchdb` does.

Each test gets a fresh home (a temporary directory on Node.js, a unique IndexedDB prefix in
the browser), so tests never share a registry.

Each runtime is a Vitest project. A project tells the suite which runtime it is through
`provide` (`inject('runtime')` in a test), so one spec asserts the right thing everywhere.
Adding a runtime means adding a project in `vitest.config.ts`.

## Layout

```
core/
  src/
    index.ts                      public API — the only entry point
    Core.ts                       abstract base, exported as a type only
    BrowserCore.ts / ServerCore.ts the core per runtime
    Runtime.ts                    runtime detection
    errors.ts                     CoreError and its subclasses
    dataset/
      lifecycle.ts                createDataset, openDataset
      Registry.ts                 the runtime's list of known datasets
    platform/
      Platform.ts                 what each runtime provides: engines, home, core class
      loadPlatform.ts             loads only the current runtime's platform
      nodejs.ts / browser.ts      LevelDB + HTTP / IndexedDB + HTTP
    storage/
      DatabasePool.ts             one shared, reference-counted PouchDB per location
      DatabaseLocation.ts         where a database lives, and credentials
      StorageDescriptor.ts        what the registry stores; dataset and registry locations
      couchdb.ts                  opens a CouchDB database over HTTP
    cluster/
      ClusterDocument.ts          the _design/cluster document
      Cluster.ts                  the core's view of its cluster; forwarding (none yet)
    capabilities/                 capability definitions and local implementations
  tests/
    e2e/                          public API, every runtime, src and dist
    unit/                         internals, every runtime
    setup/                        local HTTP server, temp homes, CouchDB check
    support/                      fresh homes and automatic core cleanup
  compose.yaml, couchdb/          CouchDB container for integration tests
  vitest.config.ts                one project per runtime
```

**Platforms load lazily.** `loadPlatform` imports only the current runtime's module, so a
browser never loads LevelDB and Node.js never loads IndexedDB.

**Databases are pooled.** PouchDB's LevelDB adapter shares one store per path inside a
process, and closing any instance closes it for all. `DatabasePool` hands out
reference-counted handles instead, so two cores on one dataset close independently.
