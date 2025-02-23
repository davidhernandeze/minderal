# Minderal - Local-first database for widgets.
Widgets are chunks of data that can be used to build a user interface. Minderal is a local-first database for storing widgets. It allows users to create, read, update, and delete widgets. The database is stored locally on the user's machine and can be synced with a remote database.

## Run web server
```commandline
npm run dev
npx tauri dev
```

## Build
```commandline
npm run build
npx tauri build
```


## Database
The database uses couchdb document protocol, allowing PouchDB to store local databases as well as sync with remote databases.

## Widgets
Widgets are stored in the database as documents. Each widget has at least the following fields:
- _id: unique identifier
- name: widget name
- widget: widget name
- parent_id: parent widget id
- _rev: revision number

## Widget content
Each widget can have a `content` field that stores the widget's data. The `content` field can be any JSON object.

Each widget can be defined to has the following features:
- Contain other widgets e.g. folder widgets contain other widgets.
- Define how it stores data with in `content` field e.g. text widgets store string data in the `content` field.
- Define a custom preview component e.g. text widgets show the first 100 characters of the `content` field.
- Define an expandable view e.g. folder widgets show all children widgets in an expandable view.
- Show custom creation modal e.g. image widgets show a file picker to select an image file.
- Define how the contents copies to the clipboard e.g. url widgets copy the `content.url` field to the clipboard.

## Root widget
The root widget is the parent of all widgets. Widgets with `parent_id=''` are considered children of the root widget.

## About grouping same widget versions (expandable, preview) in a folder
- It isn't possible due to limitations on dynamic imports. https://vitejs.dev/guide/features#dynamic-import

## Thanks
The desktop functionality of the floating searching bar was inspired by the [tauri-macos-spotlight-example](https://github.com/ahkohd/tauri-macos-spotlight-example)
project by [ahkohd](https://github.com/ahkohd), and borrows heavily from its codebase. Thanks to [ahkohd](https://github.com/ahkohd) and the contributors
to [tauri-macos-spotlight-example](https://github.com/ahkohd/tauri-macos-spotlight-example).



