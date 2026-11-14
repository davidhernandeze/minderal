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
import { getCoreForCurrentRuntime } from '@minderal/core'

const core = getCoreForCurrentRuntime()
core.runtime // 'node' | 'browser'
```

`getCoreForCurrentRuntime()` detects the runtime, creates the matching core and returns it.
The concrete classes stay internal: callers only ever see the abstract `Core` type.

- `BrowserCore` — created in a browser.
- `ServerCore` — created in Node.js.

A core encapsulates distributed access to a single dataset. It is not a singleton: every
call creates a new, independent core, and running several cores side by side — one per
dataset — is an intended use. An unrecognized runtime throws `UnsupportedRuntimeError`.

## Development

Every step lands with tests that run end to end on every supported runtime.

```sh
npm install
npm run setup:browsers   # once: downloads Playwright's Chromium
npm run verify           # typecheck + all tests on src + all e2e tests on the built dist
```

| script | what it does |
| --- | --- |
| `npm test` | every suite, once in Node and once in headless Chromium |
| `npm run test:node` / `test:browser` | one runtime only |
| `npm run test:watch` | watch mode, both runtimes |
| `npm run test:dist` | builds, then runs `tests/e2e` against `dist/` — the shipped artifact |
| `npm run typecheck` | `tsc` over src, tests and config |

Tests:

- `tests/e2e/` — black-box, public API only, imported as `@minderal/core`. Runs against
  `src/` by default and against `dist/` under `test:dist`.
- `tests/unit/` — white-box tests of internals, imported from `src/` directly.

Each runtime is a Vitest project. A project tells the suite which runtime it is through
`provide` (`inject('runtime')` in a test), so one spec asserts the right thing everywhere.
Adding a runtime means adding a project in `vitest.config.ts`.

## Layout

```
core/
  src/
    index.ts                      public API — the only entry point
    Core.ts                       abstract base, exported as a type only
    BrowserCore.ts                the core for browsers
    ServerCore.ts                 the core for Node.js
    getCoreForCurrentRuntime.ts   detects the runtime, creates a new core
    Runtime.ts                    runtime detection
  tests/
    e2e/           public API, every runtime, src and dist
    unit/          internals, every runtime
  vitest.config.ts one project per runtime
```
