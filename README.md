# Minderal - Local-first database for widgets.
Widgets are chunks of data that can be used to build a user interface. Minderal is a local-first database for storing widgets. It allows users to create, read, update, and delete widgets. The database is stored locally on the user's machine and can be synced with a remote database.

## Table of contents
- [Philosophy](#philosophy)
- [Run dev server](#run-web-server)
- [Build](#build)
- [Database](#database)
- [Widgets](#widgets)
- [Widget content](#widget-content)
- [Example widget configuration](#example-widget-configuration)
- [Root widget](#root-widget)
- [About grouping same widget versions (expandable, preview) in a folder](#about-grouping-same-widget-versions-expandable-preview-in-a-folder)
- [Thanks](#thanks)

## Philosophy
- Standalone frontend: The frontend should be able to run without a backend server.
- Expandable: The app should be able to add new widgets easily.
- Portable: The app should be able to run on different platforms.
- Backend agnostic: The app should be able to sync with databases using CouchDB's protocol.

## Run development environment

### Run web server
```commandline
npm run dev
npx tauri dev
```

### Run desktop app with dev server
```commandline
npx tauri dev
```

## Build

### Build web app
```commandline
npm run build
```

### Build desktop app
```commandline
npx tauri build
```

## Architecture
- Frontend is built with Vue.js, Vite and TailwindCSS.
- Using PrimeVue as the main UI library.
- Using Tauri to build the desktop application.
- Using PouchDB to store the database locally and as a bridge to sync with remote databases.
- Using CouchDB as an optional remote database.


## Database
The database uses couchdb document protocol, allowing PouchDB to store local databases as well as sync with remote databases.

## Widgets
Widgets are stored in the database as documents. Each widget has at least the following fields:
- _id: unique identifier
- name: widget name
- content
- widget: widget name
- parent_id: parent widget id
- _rev: revision number

## Widget content
Each widget can have a `content` field that stores the widget's data. The `content` field can be any JSON object.

Each widget can be defined to has the following features:
- Contain other widgets e.g. folder widgets contain other widgets.
- Define how it stores data in `content` field e.g. text widget stores string data in the `content` field.
- Define a custom preview component e.g. text widget shows the first 100 characters of the `content` field.
- Define an expandable view e.g. folder widgets show all children widgets in preview mode.
- Define the default content.
- Show custom creation modal e.g. creating an image widget shows a file picker to select an image file.
- Define how the contents copies to the clipboard e.g. url widgets copy the `content.url` field to the clipboard.

### Example widget configuration
```js
  checklist: {
  label: 'Checklist',
    icon: 'bi bi-list-check',
    expandable: true,
    defaultContent: [],
    previewComponent: 'ChecklistPreview',
    expandedComponent: 'ChecklistExpanded',
}
```

## Root widget
The root widget is the parent of all widgets. Widgets with `parent_id=''` are considered children of the root widget.

## About grouping same widget versions (expandable, preview) in a folder
- It isn't possible due to limitations on dynamic imports. https://vitejs.dev/guide/features#dynamic-import

## Thanks
The desktop functionality of the floating searching bar was inspired by the [tauri-macos-spotlight-example](https://github.com/ahkohd/tauri-macos-spotlight-example)
project by [ahkohd](https://github.com/ahkohd), and borrows heavily from its codebase. Thanks to [ahkohd](https://github.com/ahkohd) and the contributors
to [tauri-macos-spotlight-example](https://github.com/ahkohd/tauri-macos-spotlight-example).



