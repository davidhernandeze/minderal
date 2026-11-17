# @minderal/app

A development app for `@minderal/core`: a browser node that joins a cluster and shows it —
every node, what it announces, who is online, whether it holds data, the links this browser
has measured — next to the dataset's documents, live.

```sh
npm install
npm run dev            # Vite on http://localhost:5173 + the dev cluster, in one command
```

Open http://localhost:5173 in Chrome and press **Join**: the dev cluster's endpoint is filled
in. The browser copies the dataset into IndexedDB, syncs it both ways, and from then on reopens
it on every reload (**Forget this dataset** to start over).

## The dev cluster

`npm run dev` starts `scripts/devCluster.ts` next to Vite (`MINDERAL_DEV_CLUSTER=off` to run it
yourself with `npm run cluster`). It runs real cores from `../core/src`:

| node | role | serves on |
| --- | --- | --- |
| Dev orchestrator | orchestrator, holds the seeded documents | `127.0.0.1:5985` |
| Media box | Node.js member — a second node to delegate to | `127.0.0.1:5986` |
| Desk | Node.js member that only syncs | — |

- **Seed data.** The first run creates the dataset and seeds 24 neurons and 4 tasks
  (`scripts/seed.ts`, deterministic). Later runs reopen the same dataset from `.dev-cluster/`,
  so what you do in the app survives restarts.
- **Reset.** `npm run cluster:reset` wipes `.dev-cluster/` and seeds again. Then press
  **Forget this dataset** in the app, since the browser still holds the old one. Clusters
  seeded before neurons replaced notes still hold `note:` documents; reset to get the new seed.
- **Live activity.** `MINDERAL_DEV_ACTIVITY=on npm run dev` (or `npm run cluster -- --activity`)
  writes a neuron every 5 s (from the orchestrator, or Media box in relay mode), to watch changes
  arrive and every node's seq move.
- **Relay mode.** `npm run dev:relay` runs the same cluster with an orchestrator that holds no
  data (state in `.dev-cluster-relay/`): Desk seeds the data, and members pull from whichever
  holder told of a change — the browser included, through the orchestrator's relay. Stop the cluster
  with the browser closed and its data waits; `npm run cluster:relay:reset` starts over.
- **Presence.** Nodes renew a 6 s lease every 2 s here, so the diagram's online dots follow
  within seconds when a node comes or goes.
- **Allowed origins.** The nodes accept browser requests from `http://localhost:5173` and
  `http://127.0.0.1:5173` only; set `DEV_CLUSTER_ORIGINS` (comma-separated) for others.
  `DEV_CLUSTER_PORT` and `DEV_CLUSTER_HOST` move the endpoints.

## Things to try

- **Seq.** Each card holding data shows where its copy's changes feed is and when it last
  moved — the browser's from its own feed, the others' from presence. Add a neuron and watch
  every holder's seq follow. Seqs of different nodes do not compare: each counts its own changes.
- **Client mode.** Untick *Keep a copy of the data in this browser* when joining: nothing is
  stored in the browser, every read and write goes to a node holding the data. The diagram
  draws the link it measured to that node.
- **Offline.** Stop the dev server, add neurons in the app, start it again: they reach the
  orchestrator. Neurons the orchestrator writes meanwhile (`--activity`) arrive in the browser.
- **Delegation.** `core.fetch` in the side panel: the browser cannot fetch other origins freely,
  so it asks the fastest node that announces `fetch@1`. The diagram draws the links it measured,
  with their latency, and marks a node that just failed.
- **Fallback** to the next node when the best one fails is covered by the core's tests
  (`core/tests/e2e/delegation.test.ts`); the app shows its result as a red link.

## Layout

```
app/
  scripts/devCluster.ts   the dev cluster: create + seed on first run, reopen afterwards
  scripts/seed.ts         the seed documents
  vite.config.ts          aliases @minderal/core to ../core/src; runs the dev cluster; /__dev-cluster
  src/composables/useCore.ts   one browser core: join, reopen, reactive cluster view
  src/components/              ClusterDiagram, NodeCard, DocumentsPanel, ActionsPanel
```

The app imports the core's source, so a change in `core/src` reloads the app. `npm run
typecheck` builds the core's declarations first and checks the app against them.
