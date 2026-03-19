# Minderal – CLAUDE.md

Agent-oriented project context. Read this before making any changes.

---

## What This App Is

Minderal is a **widget-based personal workspace** — a Vue 3 SPA where users store and interact with structured content units called *widgets* (text, counter, countdown, switch, folder, etc.). It uses PouchDB locally and can sync with a remote CouchDB. The app supports multiple tabs, each backed by an independent database + workspace.

**Current focus: the TypeScript-first (`refactor/ts`) version.** All new code lives in `src/domain/`. Ignore legacy patterns in `src/enums/widgets.js`.

---

## UI Component Rule

**Always check the PrimeVue MCP server before building custom UI components.** Use `mcp__primevue__suggest_component`, `mcp__primevue__get_overlay_components`, or `mcp__primevue__search_components` to find existing PrimeVue components first. Only create custom components when PrimeVue doesn't cover the use case.

---

## Stack

| Layer | Tech |
|---|---|
| UI | Vue 3 SPA, PrimeVue components, Bootstrap Icons |
| Language | TypeScript (domain + new components), some legacy JS Vue SFCs |
| Build | Vite |
| Persistence | PouchDB (browser), CouchDB-compatible remote sync |
| Reactivity | Node `EventEmitter` in domain objects → Vue composables in UI |
| Targets | Web, Android (Capacitor), Desktop (Tauri) |

---

## Domain Architecture (`src/domain/`)

The domain layer is **framework-free** — no Vue reactivity here. It uses Node `EventEmitter` for all state changes.

### Object Hierarchy

```
Application
 └── Connection (remote or local, manages Database instances)
      └── Database (PouchDB wrapper, emits change events)
           └── [used by] Tab
                └── Workspace (navigation context + widget type registry)
                     └── WidgetFactory (constructs Widget instances)
                          └── Widget (base class for all content units)
```

### Key Classes

**`Application`** (`Application.ts`)
- Singleton entry point. Manages `Connection`s and `Tab`s.
- Reads/writes a `config` PouchDB document to persist state across reloads.
- On first launch: creates a local connection, opens a tab, and seeds a default text widget.
- Events: `connections:changed`, `tabs:changed`.

**`Connection`** (`Connection.ts`) / **`LocalConnection`** (`LocalConnection.ts`)
- Represents a database server (local or remote CouchDB).
- Holds a map of `Database` instances. `LocalConnection` is a singleton.
- Events: `change`.

**`Database`** (`Database.ts`)
- Wraps PouchDB. Listens to live changes and re-emits them as targeted events.
- Key events emitted: `doc:changed:<docId>`, `child:changed:<parentId>`.
- CRUD: `createWidgetDoc`, `updateDoc`, `deleteDoc`, `getDoc`, `getDocsByParentId`.
- Soft-delete: sets `deleted_at` timestamp; hard-delete via `hardDeleteDoc`.
- `monitorClient()` polls every 10s to detect connectivity.

**`Workspace`** (`Workspace.ts`)
- Represents one tab's navigation state.
- Holds the currently `expandedWidget` and a `filter` string.
- `navigateToWidget(id)`: loads widget, attaches listeners, fetches children + route, emits `expandedWidget:changed`.
- `setFilter(q)`: updates filter and triggers child re-filtering.
- `widgetTypes: Map<string, WidgetTypeDefinition>` — populated from `src/domain/widgets/index.ts`.

**`Tab`** (`Tab.ts`)
- Owns one `Workspace` bound to one `Database`.
- Persists its current `docId` back to `Application` config on navigation.
- Created via `Tab.createFromConfig(app, db, config)`.

**`WidgetFactory`** (`WidgetFactory.ts`)
- Constructs `Widget` instances using the widget type registry from `Workspace`.
- `fromDoc(doc)` → dynamic import of the widget class → instantiate.
- `createFromRequest(request)` → build a `WidgetDocStructure`, then `fromDoc`.
- `getFromId(id)` → fetch doc from DB, then `fromDoc`.
- `getOrCreateFromDoc(doc)` → try fetch, create+save on 404.

**`Widget`** (`Widget.ts`) — abstract base
- Extends `EventEmitter`. All content units extend this.
- Abstract: `key: string`, `label: string`.
- Instance flags: `expandable`, `standalonePreview`, `hideCopyButton`.
- Component name strings (resolved dynamically by UI): `previewComponent`, `expandedComponent`, `formComponent` (default `'GeneralForm'`).
- Persistence: `save()`, `rename(name)`, `delete()`, `updateContent(value)`, `move(parentId)`.
- Structure: `addChild`, `removeChild`, `fetchChildren`, `onChildrenMoved`.
- Reactivity: `listenForChanges()` subscribes to DB events → emits `content:changed`, `name:changed`, `children:changed`.
- Navigation: `openInWorkspace()` → `workspace.navigateToWidget(this.docId)`.
- Filtering: `getChildren()` applies `workspace.filter` against `getName() + getContent()`.
- Route: `fetchRoute()` walks parent chain to build breadcrumb array.

### Interfaces & Types (`src/domain/interfaces/`, `src/domain/types/`)

- `WidgetDocStructure` — PouchDB doc shape: `_id`, `_rev`, `parent_id`, `name`, `content`, `widget`, `settings`, `created_by`, `deleted_at`, `files?`.
- `DocStructure` — base with `_id`, `_rev`, timestamps.
- `WidgetRequest` — input for creating a widget (subset of doc fields).
- `FormStructure` / `FieldStructure` — describes form fields: `name`, `type` (`text` | `textarea` | `number` | `checkbox`), `label`, `required?`, `default?`.
- `ConfigDocStructure` — shape of the `config` PouchDB doc (connections, tabs, active_tab_id).

---

## Widget Type Registry (`src/domain/widgets/index.ts`)

Each entry in `staticWidgetTypes: WidgetTypeDefinition[]` has:
```ts
{ key: string, label: string, icon: string, class: () => Promise<{ default: WidgetClass }> }
```

Current widgets:

| key | class file | preview component | expanded component |
|---|---|---|---|
| `list` | `ListWidget.ts` | `FolderPreview.vue` | `FolderExpanded.vue` |
| `folder` | `FolderWidget.ts` | `FolderPreview.vue` | `FolderExpanded.vue` |
| `text` | `TextWidget.ts` | `TextPreview.vue` | `TextExpanded.vue` |
| `switch` | `SwitchWidget.ts` | `SwitchPreview.vue` | `SwitchPreview.vue` (same) |
| `counter` | `CounterWidget.ts` | `Counter.vue` | `Counter.vue` (same) |
| `countdown` | `CountdownWidget.ts` | `Countdown.vue` | — |

---

## UI Layer (`src/components/`)

UI is thin — it observes domain objects via events; it does not hold its own state.

**`WidgetPreview.vue`** — generic panel shell for each widget in a list/grid. Resolves `./widgets/preview/<widget.previewComponent>.vue` dynamically. Renders icon, editable name (`InvisibleInput`), copy button (`widget.getPastableContent()`), "Updated" footer, `WidgetMenu` context menu.

**`WidgetExpanded.vue`** — resolves `./widgets/expanded/<widget.expandedComponent>.vue` dynamically.

**`FolderExpanded.vue`** — grid of child `WidgetPreview`s with VueDraggable reordering. Observes `children:changed` via `useReactiveObjectProp`.

**`GeneralForm.vue`** — renders a `FormStructure` returned by `widget.getFormStructure()`. Supported field types: `text`, `textarea`, `number`, `checkbox`. On submit, calls `widget.updateDocFromForm(form)` + `widget.save()`.

**`useReactiveObjectProp` composable** — subscribes to a named EventEmitter event on a domain object and keeps a Vue `ref` synced to a getter. Pattern used throughout to bridge domain events → Vue reactivity.

### Component Resolution Rules
- Preview: `src/components/widgets/preview/<Name>.vue` — `widget.previewComponent` must equal `<Name>`.
- Expanded: `src/components/widgets/expanded/<Name>.vue` — `widget.expandedComponent` must equal `<Name>`.
- Form: `src/components/widgets/form/<Name>.vue` — `widget.formComponent` must equal `<Name>`.
- Icons: Bootstrap Icons class strings (e.g. `'bi bi-folder'`).

---

## Data Flow

```
User action (Vue component)
  → widget.updateContent(value) / widget.rename(name) / etc.
    → db.updateDoc(doc)            [PouchDB write]
      → PouchDB change feed fires
        → db emits doc:changed:<id>
          → Widget.listenForChanges() receives it
            → widget.updateDoc(doc)
              → widget emits content:changed / name:changed
                → useReactiveObjectProp ref updates
                  → Vue re-renders
```

Children flow: `db` emits `child:changed:<parentId>` → parent `Widget` adds the new child → emits `children:changed`.

---

## Adding a New Widget (Checklist)

1. **Domain class** — `src/domain/widgets/MyWidget.ts`
   - `export default class extends Widget`
   - Set `readonly key`, `label`, `icon`, `previewComponent`, optional `expandedComponent`, flags.
   - Implement `getFormStructure(): FormStructure` and `updateDocFromForm(form)`.
   - Override `getContent()` if content type is not a plain string.

2. **Register** — `src/domain/widgets/index.ts`
   - Add entry to `staticWidgetTypes` with `key`, `label`, `icon`, `class: () => import('./MyWidget')`.

3. **Preview component** — `src/components/widgets/preview/<PreviewName>.vue`
   - Use `useReactiveObjectProp` to observe `content:changed` / `name:changed`.
   - Call `widget.updateContent(value)` to persist changes.

4. **Expanded component** (if `expandable: true`) — `src/components/widgets/expanded/<ExpandedName>.vue`

5. **Custom form** (optional) — `src/components/widgets/form/<FormName>.vue` and set `formComponent` on the widget class. Otherwise `GeneralForm` handles it automatically.

6. **Verify** — launch app, create widget via UI, confirm preview/expanded render, name editing, content persistence, and live updates.

---

## Keeping This Document Up to Date

**Update `CLAUDE.md` whenever:**
- A new widget type is added or removed.
- A new top-level domain class is introduced (e.g. a new entity like `Tag`, `Notification`).
- The event contract of an existing domain class changes (new events emitted, old ones removed).
- The component resolution strategy changes (new path conventions, new form types).
- The persistence layer changes (new DB methods, different soft-delete semantics).
- The `Application` initialization flow changes.

Do **not** update it for: styling tweaks, minor bug fixes, or changes that are fully captured in code and don't affect how agents should understand the system.

---

## V4 Layout (`/v4` route)

A separate in-progress layout focused on a **list-based UX** and an improved widget creation flow. Access at `/v4`.

**New files:**
- `src/layouts/AppV4.vue` — layout entry point for `/v4`
- `src/components/workspace/WorkspaceV4.vue` — workspace shell (breadcrumb + WidgetList)
- `src/components/v4/WidgetList.vue` — reactive children list + ghost widget trigger
- `src/components/v4/WidgetListItem.vue` — compact single-row widget entry
- `src/components/v4/GhostWidget.vue` — unsaved "ghost" widget with inline name input + type selector
- `src/components/v4/WidgetTypeSelector.vue` — PrimeVue Popover with searchable widget type list
- `src/composables/useWidgetUsage.ts` — localStorage-backed widget type usage tracker (exposes `recordUsage`, `sortByUsage`)

**Ghost widget creation flow:**
1. User clicks "+" or "Add first item"
2. `GhostWidget` appears: type button on left (most-used type pre-selected), name input focused
3. Clicking the type button opens `WidgetTypeSelector` (Popover with auto-focused search)
4. Types are ordered by usage frequency via `useWidgetUsage`
5. Pressing Enter or clicking outside commits: calls `widgetFactory.createFromRequest(...)` + `widget.save()`
6. Pressing Escape discards the ghost

---

## Notes & Known Gaps

- Drag-and-drop reorder in `FolderExpanded.vue` references a legacy doc ordering API; domain-level reorder persistence is incomplete.
- `SwitchWidget` sets `expandable: true` but uses the same component for both preview and expanded — acceptable but inconsistent.
- `WidgetDocStructure.content` is typed as `string | number | boolean | null` but some widgets (e.g. `CountdownWidget`) store objects. Cast with `as unknown as T` where needed.
- `Database.migrate()` is a no-op stub — left for future migrations.


## PouchDB
- the documentation for PouchDB is in /docs/PouchDB.html
