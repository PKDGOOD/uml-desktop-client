# Architecture

## Repository map

```text
src/
  App.tsx                 Workspace composition and file actions
  components/             React canvas, editor, properties, project tree, tabs
  engine/                 Sessions, synchronization, undo, export, snapshots
  parser/dsl/             Canonical grammar, Peggy parser, serializer
  parser/project/         Project JSON parser and serializer
  store/                  Zustand UI state
  types/                  Shared models and command types
electron/                 Main process, preload, file I/O, recent project paths
scripts/                  Repository validation and license-notice generation
examples/                 Synthetic DSL examples that repository checks parse
docs/                     Current architecture, roadmap, process, review records
.github/                  CI, dependency updates, contribution forms, ownership
.kiro/specs/               Historical requirements and design (Korean)
```

Tests are colocated with source as `*.test.ts`.

## Editing and state

`App → ProjectSession → per-diagram SyncEngine + UndoManager` owns editing lifetime. React and Zustand hold UI state; `refreshWorkspace` mirrors session state into the UI. Multiple representations still need stronger consistency guarantees; a central semantic validator has not yet been implemented.

- Text → `parseDSL` → model → canvas
- Canvas/property command → `CanvasChange` → model → `serializeDSL` → text
- Public DSL API: `src/parser/dsl/index.ts`
- Grammar source: `src/parser/dsl/uml.pegjs`, imported with `?raw`; do not duplicate it
- Persisted structure: `ProjectData`, including text drafts in `diagramTexts`

The current representation is not lossless. Read [known limitations](known-limitations.md) before changing the model or describing supported semantics.

## Persistence and trust boundaries

Desktop: `App → preload → IPC → fileIO → atomicWrite`. Browser: file input and Blob download. A completed native write and a browser download request provide different guarantees.

History uses `VersionManager + localVersionStorage`. Snapshots stay in the local profile and are not included in `.uml.json` files. They are not automatic crash recovery or portable backups.

Imported JSON, DSL, renderer IPC payloads, and paths require validation. Context isolation and disabled Node integration are present; approved-path/sender validation and CSP/navigation hardening are still roadmap work.

## Build and development

Default Vite mode enables Electron main/preload and renderer plugins. `--mode browser` excludes Electron plugins. Production bundles load relative assets for the packaged `file://` entry. The parser currently compiles its grammar at runtime; precompilation is tracked as security/build work.

## Implemented modules outside the current product flow

| Module | Current integration |
| --- | --- |
| `lazyLoader`, `lruCache` | Unit-tested, not used by App's project loading path |
| `sharedElementRegistry` | Engine/tests exist; shared editing flow is not connected |
| `SharedElementContextMenu` | Not used by the current canvas |
| `VersionManager.diff` | Not exposed by History UI |
| Recent-project IPC | Records paths; no recent-project picker UI |

These modules are retained for review and future design. Unused older parsers/tokenizers and duplicate grammars were removed; Git history retains them.
