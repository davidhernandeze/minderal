# Minderal
A document database manager system, where each database follows strict standards to define data and functionality ad adad adasd asdada da d

# High level concepts
- oop: object oriented programming, referring on this document to approximate concepts
- core: a typescript library intended to control the whole database lifecycle
- core database access abstraction layer: a database can live on under different database engines
    - pouchdb is used the first layer to normalize access to database engines
- core feature access abstraction layer:
    - depending on the environment core is running
    - it has different capabilities
    - it tries to fallback to replacements capabilities if needed or return a grateful fail
    - a good example is data fetching, easy to do on a nodejs environment, tricky for a browser
    - it also applies for database capabilities, authentication
    - topology can influence capabilities as a whole system
- database engines: couchdb (self hosted), levelDB (standalone desktop) and indexedDB (browser)
- neuron: indivisible definition of data, they are created using templates, they are stored as JSON
- developer: contributor to the codebase, modifies repositories
- database: a document database managed by the core library
- catalogs: definitions grouped by type
- definitions: objects intended to store extendable structures
    - definition types: template, rule, function
    - core is packed with a set of built-in definitions by each type
        - built-in definitions can only be added by developers
        - built-in definitions are extensible
    - extended definitions are contained in the database
- templates are neuron blueprints, they instruct how a neuron that template shall behave and be created
    - a neuron holds a unbreakable relation to a built-in or template
- implementer: leverages built-in definitions to create widgets
- widgets: group of related neurons, they share information and functionality
- relations: is where actual data live
    - defined on templates as '
    - defined on neurons and templates under `has:{}` keyed by related document id
    - compared to oop, relations are class level variables
- custom local relation
    - relation loader to distinguish

# discussion, is a template a neuron of type template?
- built-in templates can implement built-in templates ✅
- helps to define the system under its own rules
- `{ _id: "template", implements: "neuron" }`
- `{ _id: "template", implements: "neuron" }`
- `{ _id: "string", implements: "template" }`

the paid service tier, includes a private broker and a couchdb database
- it can be accessed and be prioritized by the broker
- other device can do backups and in case the node goes down, a free tier broker can be created with devices owning a copy

# why typescript
- it only makes sense to use a typed system
- it's the most portable language at the moment
    - server mode using nodejs
    - can run on most browsers
    - easily portable into apps using capacitor
    - easily to run as a server desktop app using tauri sidecar

# objectives
- a general distributed data solution
- open source and diy options
- max portability
-

# neuron processors
- a neuron can have references to other neurons inside text

# discussion: is name a relation?
- the idea of name outside a relation is that it can be indexed and queried, separated from other attributes
- relations normally points to other documents to hold the data
- name value needs to be present and it has a locked template
- if we do `_name` a required built-in attribute, we can use existing relations logic
    - we avoid custom logic to process/access
    - we need to be sure, neurons got indexed by name
    - this is a special type of relation definition where it is indicated it lives in the owner neuron
    - we can do `_value` a custom local relation

# relations
## custom relations
- when for example a user types a dot as the last character of the string, a select or create dropdown shows
- if a new neuron is created in the spot, the new created neuron is added to the `has:` property using its uuid as the relation key

# ideas to sort about the solution
# add or create
- is it very common to see a add or create dropdown
- a UI component that can show nearly everywhere in the ui

# users
- user is a built-in template


# Grid UI system
- Layout: a list of blocks plus a few global settings
    - Settings
        - Gap: the space between blocks
        - Height unit: the fixed height of one vertical step (e.g. 48px)
        - Minimum block width: the narrowest a block may get before it widens (e.g. 160px)
    - Blocks
        - Each block has a unique name
            - The UI uses the name to decide which component to show
        - A block stores only its size and its order, never its position
            - Positions are calculated, so the same data works at every screen size
- Rows
    - Each block belongs to a row (a number)
    - Rows are drawn top to bottom in ascending order
    - Blocks are placed in a row in the order they appear in the list
    - Rows stack downward with no height limit
        - If they don't fit on screen, the page scrolls
    - A row is as tall as its tallest content
- Width (w)
    - The screen is split into 12 equal columns
    - w: 1 to w: 12 means the block is that many columns wide
    - w: 0 means "take the space left on this line"
        - If the block is alone, it's full width
        - If other blocks follow it on the line, it leaves room for them
        - Can be used as an empty spacer to push other blocks to the right
- Height (h)
    - h: 1 and up is a fixed number of height units
        - The block is the same physical height on every device
    - h: 0 changes meaning with the screen size
        - On large screens it fills
            - If a row has only h: 0 blocks, the row fills the leftover screen height
            - If the row also has fixed blocks, the h: 0 block stretches to the row's height
        - On small screens it's as tall as its content
- Placement
    - Each block goes into the first free spot
        - The search runs top to bottom, then left to right
    - Short blocks stack beside a tall one
        - Example: three 1-unit indicators stack next to a 4-unit avatar
    - Some empty cells can be left behind
- Responsive behaviour
    - Screen sizes
        - Small: under 600
        - Medium: 600 to 1023
        - Large: 1024 and up
        - The size is measured from the parent container, not the device
    - Automatic widening
        - A block that gets narrower than its minimum width widens
            - It snaps to a clean width: 3, 4, 6 or 12 columns
        - On narrow screens most blocks end up full width, so the layout becomes a simple vertical stack
    - No thin gaps
        - Leftover space on a line that is too narrow to use goes to the block next to it
    - Per-size overrides
        - Optional changes for one screen size only
            - A different width, height or row
            - Hide or show a block
        - Values set here are used exactly as written, with no automatic widening
- Nesting
    - A block can contain its own list of blocks
    - The inner layout follows the same rules
        - Its parent block acts as its container
        - Its screen size comes from the parent block's width
    - Use nesting when something must sit beside several rows (e.g. a sidebar)
- How it is built
    - Calculator: one shared function
        - Input: the layout data, plus the container width and height
        - Output: column, span, line and height for every block
        - It must give identical results on every platform
            - Every platform runs the same set of test cases to prove it
    - Renderer: one thin layer per platform
        - It only puts each block where the calculator says
        - Web uses CSS grid
        - Mobile uses each platform's own custom layout tool


# Floating documents
- asks for scope: widget, tab, app


# Core fresh initialization
- this happens when the library boots into a environment
- it creates .root
