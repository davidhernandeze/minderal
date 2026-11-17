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
import { capabilities, createDataset, joinDataset, openDataset } from '@minderal/core'

const core = await createDataset({ name: 'Desk' })       // new dataset in this runtime's local storage
const again = await openDataset(core.datasetId)          // a dataset this runtime already knows
await core.serve({ port: 5985, origins: ['http://localhost:5173'] })   // Node.js: reachable by other nodes
const relay = await createDataset({ storage: { engine: 'none' } })     // Node.js: an orchestrator storing no data

// in a browser, or another Node.js process
const member = await joinDataset('http://127.0.0.1:5985/minderal-<id>', { name: 'Phone' })
const client = await joinDataset(endpoint, { storage: { engine: 'none' } })   // client mode: no copy
await member.documents.put({ _id: 'note:1', title: 'Hello' })   // local first, synced in the background
await member.sync()                                             // or right now, both ways
const response = await member.fetch('https://example.com')      // a browser delegates it to a server node

member.cluster.nodes                     // every node: name, runtime, role, core version, capabilities…
member.cluster.nodesWith(member.fetch)   // nodes that can fetch — named by the method, not a string
member.cluster.qualityOf(nodeId)         // latency and outcomes this core measured talking to a node
member.cluster.isOnline(nodeId)          // presence, from the member's channel to the orchestrator
member.cluster.subscribe(() => render()) // nodes or measurements changed
await member.close()
```

A core does one job: give access to one dataset. It is created by `createDataset`,
`openDataset` or `joinDataset`, never directly, and callers only see the abstract `Core` type —
`ServerCore` (Node.js) and `BrowserCore` stay internal. Several cores can run side by side,
including several on the same dataset.

## Datasets

A dataset is a CouchDB-compatible database, accessed through PouchDB.

| storage | runtime | where |
| --- | --- | --- |
| `{ engine: 'local' }` (default) | Node.js | LevelDB under `<home>/datasets/<id>` |
| `{ engine: 'local' }` (default) | browser | IndexedDB, named `<home>/datasets/<id>` |
| `{ engine: 'couchdb', url }` | both | database `minderal-<id>` on that server |
| `{ engine: 'none' }` | Node.js orchestrator (create), any member (join) | no copy: the cluster document only, under `<home>/clusters/<id>` — see below |

A CouchDB server still counts as *local* storage for the core using it: local means the
core reads and writes the storage itself.

**Client mode.** `joinDataset(endpoint, { storage: { engine: 'none' } })` joins without a
copy: nothing is stored but the cluster document, and every read and write goes to a node
holding the data, through `database@1`. `core.holdsData` is false, the node announces no
`database@1`, and `core.sync()` reports nothing moved.

- Requests go to the best node holding the data — its own endpoint, or a relay through the
  orchestrator when it has none — and stick to the node that answered last while it can, so
  a client reads its own writes.
- `core.documents` keeps its API and its errors (`DocumentConflictError`, `StorageError`). The
  cluster adds its own: `CapabilityUnavailableError` while no node holding the data can be
  reached, and the delegation outcomes, `DelegationError` and `PartialResultError`.
- `list()` reads the changes feed with documents, the replication API every holder answers;
  fine for now, to be paged. `watch()` long-polls it; when a different node starts answering,
  the watch restarts from that node's present, since sequences are per node, so changes made
  during the switch can be missed but never repeat.
- A client opens offline like any core; its documents throw `CapabilityUnavailableError`
  until the cluster is back.

**Registry.** Each runtime keeps a registry of the datasets it knows, so `openDataset(id)`
knows how to reach a dataset. It lives in `<home>/registry`. The default home is
`MINDERAL_HOME` or `~/.minderal` on Node.js, and `minderal` in a browser; every function
accepts `{ home }` to use another one. The registry never stores credentials: pass
`{ credentials }` when opening, or set `MINDERAL_COUCHDB_USERNAME` and
`MINDERAL_COUCHDB_PASSWORD` on Node.js. For a joined dataset it also keeps the endpoint
joined through, to find the cluster again.

**Documents.** `core.documents` gives raw access — `get(id, { conflicts })`, `put`, `remove`,
`list`, `watch(listener)` — so sync can be exercised and seen end to end, from the local copy
or, in client mode, from the cluster. It is provisional and
gives way to the neuron and template model. Ids starting with `_` are the system's and refused
with `TypeError`; writing over a stale revision throws `DocumentConflictError`.

## The cluster

Every dataset holds a `_design/cluster` document listing its nodes. Each node is described by
what it announces, plus what the cluster assigns it:

```json
{ "_id": "_design/cluster", "dataset": "<id>", "nodes": [{
    "id": "<uuid, generated by the orchestrator>", "role": "orchestrator",
    "name": "Desk", "runtime": "nodejs", "coreVersion": "0.0.0",
    "capabilities": ["fetch@1", "serve@1"],
    "userAgent": "Node.js/22.16.0", "os": "Darwin 24.4.0 (arm64)",
    "endpoint": "http://127.0.0.1:5985/minderal-<id>",
    "joinedAt": "2026-11-16T10:00:00.000Z", "announcedAt": "2026-11-16T10:00:00.000Z" }] }
```

| field | |
| --- | --- |
| `id` | the founding node generates its own; the orchestrator generates every other one when it admits the node |
| `name` | chosen by the user (`{ name }` on create, join or open); defaults to the host name on Node.js and to browser and OS in a browser |
| `role` | `orchestrator` (a Node.js founder) or `member` |
| `coreVersion` | the library version the node runs (`CORE_VERSION`) |
| `capabilities` | ids of what the node can perform now — see Capabilities |
| `userAgent`, `os` | where it runs, when the runtime tells |
| `endpoint` | where other nodes reach it, once it serves |

**The orchestrator writes the cluster document**, and nobody else: members announce
themselves to it over HTTP, and replication refuses their writes to `_design/*`. A dataset
founded in a browser has no orchestrator; its only node writes the document itself.

**Lifecycle.**

- *Founding.* `createDataset` writes the document with the founder as its only node: the
  orchestrator on Node.js, a lone member in a browser.
- *Joining.* `joinDataset(endpoint)` reads the endpoint's status, asks the orchestrator to
  admit this node (`POST /_minderal/join`, which returns the node id), copies the dataset into
  local storage, registers it, and starts syncing. Joining a dataset the runtime already holds
  opens it instead.
- *Opening.* A member opens from local storage — offline is fine — then syncs and announces in
  the background.
- *Announcing.* Whenever what a node would announce differs from the record — a new name, core
  version, capability or endpoint — it announces again (`POST /_minderal/announce`), and the
  orchestrator records it. An announcement that cannot reach the orchestrator stays pending and
  goes out with the next sync.
- *Sync.* Members replicate with the orchestrator continuously (live, retrying with backoff up
  to 30 s) and on demand with `core.sync()`, which resolves once both directions are done and
  throws `NetworkError` when the orchestrator cannot be reached. Writes never wait for the
  network; conflicts resolve the CouchDB way, with the same winner everywhere and the losers
  kept in `_conflicts`.

### Presence

Every member keeps a **channel** open to its orchestrator: `GET /_minderal/channel?node=<id>`,
a long-lived NDJSON response. The orchestrator welcomes it with lease terms, then sends down it:

| message | |
| --- | --- |
| `welcome` | `{ heartbeatMs, leaseMs }` — the member renews with `POST /_minderal/channel/heartbeat` every `heartbeatMs` |
| `presence` | who is online and since when, on every change |
| `cluster` | the cluster document, revision history included, on connect and on every change |
| `request` / `cancel` | relayed requests — see Relay |
| `ping` | every heartbeat, so a member notices a dead connection |

A member is **online** while its channel is open and its lease renewed: closing the core takes
it offline at once, a node that vanishes without closing goes offline when its lease runs out
(30 s by default; `{ presence: { heartbeatMs, leaseMs } }` on an orchestrator's create or open).
Members reconnect with backoff, up to 30 s. `core.cluster.isOnline(id)` and `onlineSince(id)`
answer from what the channel last said; while a member's channel is down it knows only itself
to be online. `GET /_minderal/status` lists `online` too.

Presence is live state: it is never written to the cluster document. Members store the
pushed cluster document with its revisions as they are, so every copy converges.

### Relay

A browser cannot accept connections, yet it can answer requests: the orchestrator relays them
down its channel, and the browser posts the answer back (`POST /_minderal/channel/reply`) as the
same delegation frames an endpoint streams. So any node that is online is reachable, endpoint
or not.

- **Inside the library**, delegation does it on its own: a node announcing a capability without
  an endpoint is a candidate while it is online, reached through
  `POST <orchestrator>/_minderal/relay/<node>/invoke/<capability>`.
- **Outcomes** are the same three as any delegation. A node that goes offline before answering
  is a refusal (the next candidate is tried); one that goes offline mid-answer cuts the result,
  and the requester reads `PartialResultError`. A requester that goes away cancels the request
  on the node.

### An orchestrator without data

`createDataset({ storage: { engine: 'none' } })` makes a Node.js orchestrator that keeps no
copy of the dataset — only its cluster document. Its data lives on the members: every node
holding a copy announces `database@1`, the capability of answering a CouchDB API request from
its own copy. The orchestrator serves its endpoint by relaying each request to an online
member that holds the data:

```
Browser B ──sync──▶ Orchestrator (no data) ──relay──▶ Browser A (IndexedDB)
```

- Members sync through the orchestrator exactly as before; they cannot tell. A requester is
  never relayed to itself (members identify themselves with `x-minderal-node`), and keeps
  being served by the same holder while it can, which keeps replication checkpoints useful.
- With **no other holder online**, the endpoint answers 503: `core.sync()` throws
  `CapabilityUnavailableError` for `database@1`, live sync retries, and writes stay local until
  a peer is back.
- **Joining** works with nobody holding the data: the newcomer gets the cluster document from
  the orchestrator, and its copy fills in once a holder is online. The first member to join
  is where the data starts.
- The orchestrator's own `core.documents` works in client mode: through its members, relayed
  over their channels.

This lets a small server coordinate a cluster while storing nothing of it.

## Serving

`core.serve(options)` makes a `ServerCore` reachable by other nodes and returns its
endpoint. It is Node.js only: a `BrowserCore` throws `CapabilityUnavailableError`, and the
call is never forwarded to the cluster.

| option | default | |
| --- | --- | --- |
| `port` | `0` (any free port) | pass a fixed port: the endpoint is stored in the cluster document |
| `host` | `127.0.0.1` | `0.0.0.0` / `::` serve every interface and then require `publicUrl` |
| `publicUrl` | `http://<host>:<port>` | the base URL other nodes use, e.g. behind a proxy |
| `origins` | none | browser origins allowed in, e.g. `http://localhost:5173`, or `*` |

- The dataset is served at `/minderal-<id>`. Datasets served on the same host and port
  share one listener; it stops when its last core closes.
- Serving announces the endpoint: the orchestrator records it before `serve()` resolves, a
  member announces it through the orchestrator.
- **Browsers need `origins`.** No origin is allowed by default: any web page the user visits
  could otherwise read a dataset served on localhost. Allowed origins get CORS with
  credentials, as PouchDB's HTTP adapter requires.

Endpoints under `/minderal-<id>/_minderal/`:

| | |
| --- | --- |
| `GET status` | `{ dataset, nodes, online, holdsData }` |
| `POST join` | `{ node: announcement }` → `{ dataset, nodeId, cluster }`; orchestrator only |
| `POST announce` | `{ nodeId, node: announcement }` → `{ cluster }`; orchestrator only |
| `POST invoke/<capability id>` | performs a capability for a node of the cluster (`x-minderal-node` header) — see Delegation |
| `GET channel?node=<id>` | a member's channel — see Presence; orchestrator only |
| `POST channel/heartbeat`, `POST channel/reply` | lease renewal; frames answering a relayed request |
| `POST relay/<node>/invoke/<capability id>` | performs a capability on a member through its channel — see Relay |

**Sync without CouchDB.** The endpoint implements the part of CouchDB's HTTP API that
PouchDB replication uses (`src/database/couchApi.ts`, runtime-neutral, so a browser answers
it too when relayed), on top of the core's own LevelDB database: the server root,
`GET /{db}`, `_changes` (normal and long-poll with heartbeats, including `_doc_ids`),
`_revs_diff`, `_bulk_get`, `_bulk_docs`, document GET/PUT including `_local` checkpoints,
attachment GET and `_ensure_full_commit`. Any client that replicates with CouchDB —
stock PouchDB included — replicates with a Node.js core, with revision histories,
conflicts, deletions, checkpoints and attachments intact.

Writes to `_design/*` over HTTP are refused as `forbidden`, the way CouchDB reports a
failed validation: replicators count it as a failed write and carry on with the rest of
the batch.

The replication suite in `tests/support/replicationSuite.ts` runs unchanged against a
served `ServerCore` and against real CouchDB, so any divergence from the reference
behavior fails a test.

## Capabilities

A capability is a method on `Core` — `core.fetch(...)` — never a string key. Callers get
exactly one of two outcomes: the result, or a typed exception. Where the work ran is
invisible to them.

```
core.fetch(url)
  ├─ the core implements it locally  → runs it              (ServerCore: Node's fetch)
  └─ it does not                     → delegates it to the best node of its cluster that can
                                       → none can: CapabilityUnavailableError
```

**Contracts are immutable.** A capability is defined once with `defineCapability`: a name, a
version, a contract (its arguments and result, in words) and, if it may run on another node,
a wire format. Its id is `<name>@<version>` — `fetch@1`. Once published the contract never
changes: implementations may get faster or switch libraries, but what goes in and comes out
stays. A different shape is a new capability, `fetch@2`, next to the old one.
`capabilities.lock.json` holds a fingerprint of every published contract; changing one, or
dropping an id, fails the test suite.

The catalog: `database@1` (answer a CouchDB API request from the node's copy — every node
holding data), `fetch@1` (Node.js), `serve@1` (Node.js, never forwarded).

**Naming without strings.** `capabilities.fetch` is the capability object, and so is the
method itself: `cluster.nodesWith(core.fetch)` and `cluster.nodesWith(capabilities.fetch)`
are the same query. Ids appear only on the wire and in the cluster document.

**Availability.** What a node can do depends on more than its runtime: a browser may have a
camera without permission to use it, a server may have a media store attached or not. Each
platform lists its capabilities in a `CapabilitySet`, and an implementation can carry an
availability probe, given the node's setup; a node announces only the capabilities whose probes
say yes. `database@1` is the first: implemented everywhere, available only on nodes holding data. Setup-made
capabilities — a camera, an S3-like media store that serves the cluster's media — plug in
there.

Error contract, the same on every core:

| outcome | when |
| --- | --- |
| result | the capability ran — for `fetch`, any HTTP status, 404 and 500 included |
| `TypeError` | invalid arguments, checked before routing (a malformed or non-http URL) |
| `CapabilityUnavailableError` | no core can perform it: none announces it, or every one that does was unreachable or refused — `attempts` lists them (local-only capabilities such as `serve` never ask the cluster) |
| `NetworkError` | a core performed it and the network failed; `cause` holds the original |
| `DelegationError` | a node accepted the request, then failed without a result: crashed, vanished, answered garbage |
| `PartialResultError` | a result started arriving and was cut; raised where the rest is read — for `fetch`, the body |

Every library error extends `CoreError`.

### Delegation

Nodes and their capabilities change while requests travel. A delegated request is built for
it: the requester never crashes, and always gets one of three outcomes.

- **Complete.** The node streams the result back; a `fetch` response's body streams as it
  arrives.
- **Error.** The capability's own error comes back as itself (`TypeError`, `NetworkError`);
  anything else as `DelegationError`.
- **Partial.** The result started and was cut — the node went away mid-stream. The caller
  already has the result; reading the rest throws `PartialResultError` with the bytes
  received.

The wire is a stream of newline-delimited JSON frames (`src/cluster/frames.ts`): a `head` with
the result's JSON part, `chunk`s of base64 bytes, then `end` — or `error`. A stream that stops
without either was cut.

Candidates are tried in order while they **cannot take** the request — unreachable, refusing,
or no longer announcing the capability — since none of that ran anything. Once a node accepts,
its outcome is final: nothing is retried, because the capability may have run and running it
twice is not safe for every capability.

### Quality of service

Every core measures its links on real traffic — delegated requests and announcements —
and keeps per node a moving average of latency, successes, failures and the last failure
(`cluster.qualityOf(nodeId)`). Delegation ranks candidates with it: healthy nodes by latency,
then nodes never measured, then nodes that failed in the last 30 s; ties go to the orchestrator.
Long-polls count as successes but not toward latency, since they wait on purpose.
A node that fails goes to the back of the line for 30 s, or until it succeeds again, without
anyone configuring anything.

Next steps on this foundation: share measurements through the cluster so a newcomer starts
informed, and weigh throughput and load next to latency.

### Adding a capability

1. `src/capabilities/<name>/contract.ts` — argument and result types, `defineCapability` with
   name, version and contract, and a wire format if other nodes may perform it.
2. `src/capabilities/<name>/<runtime>.ts` — an implementation per runtime that can perform it.
3. `src/capabilities/catalog.ts` — add it to `capabilities`.
4. `capabilities.lock.json` — add its fingerprint; the failing test prints it.
5. `src/Core.ts` — one public method calling `perform(...)` (or `performLocally(...)` for a
   capability that must never be forwarded), bound with `bindCapabilityMethod`.
6. `src/platform/<runtime>.ts` — `.with(capability, implementation, probe?)` on the platform's
   `CapabilitySet`.

The type checker holds the pieces together: an implementation must match its capability's
signature.

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

**The cluster harness.** `tests/setup/clusterHarness.ts` runs real orchestrators and Node.js
members in the Vitest process and exposes them over HTTP (`tests/support/harness.ts`), so a
test in any runtime can start a served cluster, join it, take the orchestrator offline and
bring it back on the same port, start orchestrators without data, and drive Node.js members.
Join, sync, conflict, presence, relay and delegation tests run this way in Node.js and in
Chromium alike. Harness orchestrators use 200 ms heartbeats and a 1 s lease.

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
    Core.ts                       abstract base: capabilities, sync, announcing; exported as a type only
    BrowserCore.ts / ServerCore.ts the core per runtime; ServerCore also answers joins and announcements
    Runtime.ts, version.ts        runtime detection, CORE_VERSION
    errors.ts                     CoreError and its subclasses
    dataset/
      lifecycle.ts                createDataset, openDataset, joinDataset
      Registry.ts                 the runtime's list of known datasets
    documents/                    raw document access (provisional): Documents, over LocalStore
                                  (own copy) or ClusterStore (client mode, through database@1)
    database/couchApi.ts          CouchDB replication API over a PouchDB database, any runtime
    platform/
      Platform.ts                 what each runtime provides: engines, capabilities, node description
      loadPlatform.ts             loads only the current runtime's platform
      nodejs.ts / browser.ts      LevelDB / IndexedDB, HTTP, replication, the runtime's CapabilitySet
    storage/
      DatabasePool.ts             one shared, reference-counted PouchDB per location
      DatabaseLocation.ts         where a database lives, and credentials
      StorageDescriptor.ts        what the registry stores; dataset and registry locations
      couchdb.ts                  opens a CouchDB database or another node's endpoint over HTTP
      replication.ts              applies PouchDB's replication plugin once per process
    cluster/
      ClusterDocument.ts          the _design/cluster document, nodes and announcements
      clusterStorage.ts           reads and writes it, retrying concurrent updates
      clusterClient.ts            calls another node's /_minderal endpoints
      Cluster.ts                  the core's live cluster view; forwarding
      delegate.ts                 performs a capability on another node: routes, outcomes
      frames.ts                   the delegation wire protocol
      produceFrames.ts            runs a capability for another node, as frames
      channel.ts                  channel messages and presence timing
      ChannelClient.ts            a member's channel: reconnects, heartbeats
      RelayHub.ts                 the orchestrator's channels: presence, leases, relayed requests
      QualityLedger.ts            link quality measurements and candidate ranking
    server/                       Node.js only, loaded through ServerCore
      serveDataset.ts             mounts a dataset on a listener, builds its endpoint
      HttpListenerPool.ts         shared listeners per host:port, CORS
      DatasetEndpoint.ts          HTTP for one dataset: the CouchDB API (local or relayed), /_minderal
      invoke.ts                   runs a delegated capability and streams its frames
      http.ts                     JSON bodies, CouchDB-shaped errors
    capabilities/
      Capability.ts               defineCapability: id, contract, wire format
      CapabilitySet.ts            a runtime's implementations and availability probes
      catalog.ts                  `capabilities`, every definition
      methods.ts                  core methods as capability names
      database/, fetch/, serve/   contracts and implementations
  capabilities.lock.json          fingerprints of published contracts
  tests/
    e2e/                          public API, every runtime, src and dist
    unit/                         internals, every runtime
    setup/                        local HTTP server, temp homes, CouchDB check, cluster harness
    support/                      fresh homes, core cleanup, harness client, replication suite
  compose.yaml, couchdb/          CouchDB container for integration tests
  vitest.config.ts                one project per runtime
```

**Platforms load lazily.** `loadPlatform` imports only the current runtime's module, so a
browser never loads LevelDB and Node.js never loads IndexedDB.

**Databases are pooled.** PouchDB's LevelDB adapter shares one store per path inside a
process, and closing any instance closes it for all. `DatabasePool` hands out
reference-counted handles instead, so two cores on one dataset close independently.

The development app in `../app` joins a local dev cluster from Chrome and draws it.
