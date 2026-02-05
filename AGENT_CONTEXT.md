### Minderal – Agent-Oriented Project Context

This document summarizes the current architecture, project structure, and business logic patterns as implemented in the repository. It is written for a coding agent to quickly onboard and make consistent changes.

---

#### Tech/Framework Overview
- App type: Vue 3 SPA (PrimeVue UI), domain-first architecture.
- Language: TypeScript for domain and most new components; some legacy Vue SFCs are JS.
- Build: Vite.
- State/persistence: Custom domain layer with Database abstraction (PouchDB/CouchDB-like semantics inferred), EventEmitter-based reactivity.

---

#### Core Domain Concepts
- Widget (src/domain/Widget.ts)
  - Abstract base class for all content units ("widgets").
  - Emits events via Node EventEmitter to notify UI: `content:changed`, `name:changed`, `children:changed`.
  - Key properties:
    - identity/doc: `docId`, `doc: WidgetDocStructure` (contains _id, name, widget type key, content, parent_id, timestamps, etc.).
    - structure: `children: Map<string, Widget>`, `parent?: Widget`, `route: WidgetRoute` (ancestry list for breadcrumbs).
    - UI metadata: `icon`, `expandable`, `standalonePreview`, `expandedComponent`, `previewComponent`, `formComponent` (default 'GeneralForm'), `hideCopyButton`.
  - Key methods:
    - Lifecycle/listeners: `listenForChanges()`, `removeListeners()`, `remove()`.
    - Persistence: `save()`, `updateDoc()`, `rename()`, `delete()`, `updateContent(content)`, `move(parentId)`.
    - Structure: `addChild(widget)`, `removeChild(child)`, `fetchChildren()`, `onChildrenMoved()`.
    - Navigation/route: `openInWorkspace()`, `fetchRoute()`.
    - Filtering: `filter()`, `getChildren()` (applies Workspace filter to name+content).
    - Accessors: `getContent()`, `getName()`, `getPastableContent()`.
  - Content typing: `updateContent` supports string | boolean | number.

- WidgetFactory (src/domain/WidgetFactory.ts)
  - Knows how to instantiate Widgets from docs/requests.
  - Uses Workspace’s widget type registry to dynamically import the right Widget class.
  - Methods:
    - `getWidgetClass(key)` → dynamic import based on registry.
    - `fromDoc(doc)` → new Widget instance.
    - `createFromRequest(request)` → builds a doc (assigns id, defaults) then `fromDoc`.
    - `getFromId(id)` → fetch doc from DB then `fromDoc`.
    - `getOrCreateFromDoc(doc)` → try fetch, else create+save.

- Workspace (src/domain/Workspace.ts)
  - Represents the current navigation context and registry of available widget types.
  - Properties: `docId` (current expanded widget id), `expandedWidget`, `filter`, `widgetTypes: Map`.
  - Key methods:
    - `navigateToWidget(id)` → loads Widget, registers listeners, fetches children and route, emits `expandedWidget:changed`.
    - `loadWidgetTypes()` → loads static registry from `src/domain/widgets/index.ts`.
    - `getWidgetTypes()` → list of WidgetTypeDefinition.
    - `setFilter(filter)` → updates filter, triggers child filtering on expanded widget.

- Database (src/domain/Database.ts)
  - Not shown in current excerpts, but API is inferred from usage:
    - Events: emits `doc:changed:<docId>` and `child:changed:<docId>`.
    - CRUD: `createDoc(doc)`, `updateDoc(doc)`, `deleteDoc(doc)`, `getDoc(id)`, `getDocsByParentId(parentId)`.

---

#### Widget Type Registry
- File: src/domain/widgets/index.ts
- Exports `staticWidgetTypes: WidgetTypeDefinition[]` with entries:
  - folder → './FolderWidget'
  - text → './TextWidget'
  - switch → './SwitchWidget'
  - counter → './CounterWidget' (added)
- Each entry includes: `key`, `label`, `icon`, and `class: () => import('...')` returning a default constructable class.
- Workspace reads this at startup to build a `Map` for on-demand class loading.

---

#### Concrete Widgets Implemented (domain classes)
- FolderWidget (src/domain/widgets/FolderWidget.ts)
  - key 'folder', expandable: true, components: Expanded='FolderExpanded', Preview='FolderPreview', standalonePreview: true.
  - Form structure: name (text, required).
  - Content: managed through children; no specific content accessors override beyond defaults.

- TextWidget (src/domain/widgets/TextWidget.ts)
  - key 'text', components: Expanded='TextExpanded', Preview='TextPreview'.
  - formComponent: GeneralForm; showMainInput: true.
  - Form structure: name (text), content (textarea).
  - Overrides `getContent()` to return string.

- SwitchWidget (src/domain/widgets/SwitchWidget.ts)
  - key 'switch', expandable: true (note: UI Preview exists, expandable flag true; expanded component points to 'SwitchPreview').
  - Form: name (text, required), content (checkbox) → boolean.
  - `getContent()` coerces to boolean.

- CounterWidget (src/domain/widgets/CounterWidget.ts)
  - key 'counter', expandable: false, components: Preview='Counter', Expanded='Counter' (not actually expanded; preview used).
  - Form: name (text), content (number, "Initial value").
  - `getContent()` returns number with default 0; `updateContent` used by UI to +/-.

- CountdownWidget (src/domain/widgets/CountdownWidget.ts)
  - key 'countdown', expandable: false, components: Preview='Countdown'.
  - Form: name (text), year (number), month (number, 0-11), day (number), time (text, HH:mm).
  - `getContent()` returns a typed object with year/month/day/time and optional offset.
  - Preview implementation uses a custom responsive UI (not the legacy <countdown-timer> element): fluid, auto-scaling numerals via CSS clamp(), grid layout with glassmorphism cards, live ticking every second, and light/dark friendly styles.

Note: There is legacy enum-based widget definition at src/enums/widgets.js (pre-domain-first). New code uses class-per-widget + registry. Some legacy Vue components still exist but are not used by the new domain layer.

---

#### UI Layer and Component Resolution
- WidgetExpanded.vue (src/components/WidgetExpanded.vue)
  - Dynamically loads expanded component from `./widgets/expanded/${widget.expandedComponent}.vue`.
  - Receives a `Widget` instance and passes it into the component.

- WidgetPreview.vue (src/components/WidgetPreview.vue)
  - Panel shell for each widget in lists/grids (e.g., inside folder).
  - Resolves preview component dynamically: `./widgets/preview/${widget.previewComponent}.vue` via `defineAsyncComponent` and `safeImport`.
  - Displays icon, editable name (InvisibleInput), copy button (uses `widget.getPastableContent()`), footer with "Updated ..." time.
  - Emits `enable-drag`/`disable-drag` hooks for drag handles (currently commented region for doc drag).
  - Integrates WidgetMenu as a contextual menu (menu impl not included in excerpts).

- FolderExpanded.vue (src/components/widgets/expanded/FolderExpanded.vue)
  - Shows grid of child widgets using VueDraggable for reordering (currently dragDisabled toggling; persistence hook references old workspace API for doc order).
  - Uses useReactiveObjectProp to track children via domain events `children:changed`.

- Preview components per widget (examples):
  - SwitchPreview.vue (src/components/widgets/preview/SwitchPreview.vue)
    - Binds ToggleSwitch to boolean content via useReactiveObjectProp; updates via `widget.updateContent` on change.
  - Counter.vue (src/components/widgets/preview/Counter.vue)
    - Displays +/- buttons (PrimeVue Button), shows numeric value via useReactiveObjectProp; updates via `widget.updateContent`.

- Utilities:
  - useReactiveObjectProp (composable) observes EventEmitter events from domain objects and provides a ref synced to a getter function on the object; used throughout for name/content/children.

---

#### Forms System
- GeneralForm.vue (src/components/widgets/form/GeneralForm.vue)
  - Renders form fields from a `FormStructure` provided by the widget class (`getFormStructure`).
  - Supported field types:
    - 'text' → InputText
    - 'textarea' → Textarea
    - 'number' → InputNumber (added)
    - 'checkbox' → Checkbox (binary)
  - Emits `submit` with raw form object; widgets handle `updateDocFromForm(form)` to map values into the doc.
  - Initializes form values on mount using potential defaults in `formStructure[field.name]?.default` (if provided).

- Widgets typically set `formComponent = 'GeneralForm'` implicitly (Widget default), unless they specify a bespoke form.

---

#### Data Flow & Reactivity
- Persistence and events originate in domain layer:
  - `widget.updateContent(value)` updates `doc.content` then calls `db.updateDoc(doc)`.
  - Database emits `doc:changed:<id>`; `Widget.listenForChanges()` updates internal doc via `updateDoc(doc)` and emits UI events (`content:changed`, `name:changed`).
  - UI composables subscribe via useReactiveObjectProp to keep Vue refs in sync.

- Children flow:
  - `Widget.fetchChildren()` uses `db.getDocsByParentId` to build child widgets via WidgetFactory; manages add/remove; emits `children:changed`.
  - `Workspace.setFilter(query)` sets a filter string; `Widget.getChildren()` filters by child.getName() + child.getContent() string match.

- Navigation & routing:
  - `Workspace.navigateToWidget(id)` updates `expandedWidget`, calls `fetchChildren()` and `fetchRoute()` for breadcrumbs; emits `expandedWidget:changed`.

---

#### Adding a New Widget (Checklist)
1) Create domain class in src/domain/widgets/MyWidget.ts
   - Extend Widget and define: `key`, `label`, `previewComponent`, optionally `expandedComponent`, flags like `expandable`, `standalonePreview`.
   - Implement `getFormStructure()` and `updateDocFromForm(form)`.
   - Override `getContent()` if needed for proper typing/serialization.
2) Register widget in src/domain/widgets/index.ts
   - Add an entry to `staticWidgetTypes` with key, label, icon, and `class: () => import('./MyWidget')`.
3) Create UI components
   - Preview component at src/components/widgets/preview/<PreviewName>.vue matching `previewComponent` string.
   - If expandable, create expanded component at src/components/widgets/expanded/<ExpandedName>.vue and set `expandedComponent`.
4) If the widget needs special form UI, implement a custom form component and set `formComponent` static/instance on the widget; otherwise rely on GeneralForm.
5) Test
   - Launch app, use Workspace UI to add the new widget (WidgetButtonBar opens a modal that uses WidgetForm + widget.getFormStructure).
   - Verify preview/expanded render, editing of name/content, persistence, and event-driven updates.

---

#### Legacy vs New Structure
- Legacy: src/enums/widgets.js originally defined widgets declaratively (label, icon, preview/expanded names, etc.). Some legacy components still exist under src/components/widgets (non-domain aware). New domain-first system supersedes this with class-based widgets and dynamic registry.
- When adding/porting widgets, prefer creating domain widget classes and new preview/expanded components under the domain-first paths.

---

#### Naming & Conventions
- Component resolution is string-based and must match filenames:
  - Preview components: src/components/widgets/preview/<Name>.vue and widget.previewComponent must equal <Name>.
  - Expanded components: src/components/widgets/expanded/<Name>.vue and widget.expandedComponent must equal <Name>.
- Icons: Bootstrap Icons class names (e.g., 'bi bi-folder').
- Events used by UI composables:
  - 'content:changed', 'name:changed', 'children:changed' on Widgets.
  - Workspace emits 'expandedWidget:changed' and 'widgetTypes:changed'.

---

#### Notable Files Referenced
- src/domain/Widget.ts – base class, events, persistence hooks, filtering.
- src/domain/WidgetFactory.ts – construction and dynamic class loading.
- src/domain/Workspace.ts – navigation, registry, filter.
- src/domain/widgets/index.ts – widget registry entries.
- src/domain/widgets/{FolderWidget,TextWidget,SwitchWidget,CounterWidget}.ts – concrete widgets.
- src/components/WidgetPreview.vue – generic panel around previews, resolving preview components.
- src/components/WidgetExpanded.vue – resolver for expanded components.
- src/components/widgets/preview/{SwitchPreview,Counter}.vue – sample previews.
- src/components/widgets/expanded/FolderExpanded.vue – lists children (grid).
- src/components/widgets/form/GeneralForm.vue – generic form renderer; supports text, textarea, number, checkbox.
- src/enums/widgets.js – legacy widget definitions.

---

#### Gaps/TODOs Observed
- Drag-and-drop reorder in FolderExpanded references legacy workspace doc ordering API; domain-compliant reordering persistence is not shown.
- Some widgets mark `expandable` true without a distinct expanded component (e.g., Switch uses preview for expanded); acceptable but consider consistency.
- Database layer is inferred; ensure any new DB interactions emit correct events for UI reactivity.

---

This document should be kept up-to-date when adding widgets, changing file locations, or altering domain/UI contracts.

---

Update – 2026-02-04 (Countdown preview readability)
- Adjusted the Countdown preview styling to avoid readability issues caused by semi-transparent, blurred rectangles over busy backgrounds.
- Changes:
  - Increased .time-box background opacity to rgba(127,127,127,0.18).
  - Removed backdrop-filter blur to prevent ghosting/overlap artifacts.
  - Strengthened border contrast and added a subtle shadow; enforced overflow: hidden.
- Rationale: Prevent overlapping visual noise so digits and labels remain legible across themes and textured backgrounds (e.g., SpaceBackground).
