# Minderal

A distributed document database manager. Each database follows strict, self-describing
standards that define its data and its functionality; the core library enforces them
across every environment it runs in — server, browser, mobile and desktop.

Objectives: a general distributed data solution, open source with DIY options, maximum
portability.

## Repository layout

```
core/     v5 core library — the active work. Start here: core/README.md
legacy/   every previous implementation, kept for reference only
```

`legacy/` is read-only reference material. Nothing in `core/` imports from it.

| path | what it was |
| --- | --- |
| `legacy/core` | previous core library (PouchDB, neurons, templates, replication) |
| `legacy/app` | Vite front end against that core |
| `legacy/minderal-app` | the original full application |
| `legacy/pipe` | pipeline experiment (`ARCHITECTURE.md`) |
| `legacy/scripts` | one-off operational scripts |
| `legacy/plan_for_refactor.md` | accumulated design notes: concepts, grid UI system, open questions |

## Status

v5 is a rewrite of the core library from scratch, on the branch `v5-rework`. The point is
to set the architecture first — the two abstraction layers, the self-describing
definition model, the portability contract — and let features follow from it, reusing
what the previous four attempts proved and dropping what they did not.
