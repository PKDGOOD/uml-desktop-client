# ADR 0001: Versioned project file envelope and compatibility policy

- Status: **Accepted** (A02.01; maintainer accepted 2026-10-27, including unknown-key rejection and the first-save legacy ID)
- Date: 2026-10-27
- Backlog: [A02.01](../atomic-execution-plan.md) · Contracts: [P-05, P-06, AC-05, AC-14](../product-spec.md)
- Inputs: A01.03 capability matrix and A01.08 invalid-file reproductions (F4a–F4d) in the [baseline report](../reviews/2026-09-27-execution-baseline.md)
- Implemented by: A02.04 (codec), A02.06/A02.07 (legacy migration), A03.01/A03.08 (validation), A02.08 (session wiring)

## Context

The current `.uml.json` file (written by `src/parser/project/projectFileSerializer.ts`) has these problems:

1. **One field means two things.** `metadata.version` is always written as `"1.0.0"`, and nothing checks it. Nobody can tell whether it is a schema version or an app version, so a file claiming `999.0.0` opens as if it were current (F4d).
2. **The project has no identity.** Local history is keyed by `createdAt` + name, so a copied file shares and can restore the original's history ([issue #2](https://github.com/PKDGOOD/uml-desktop-client/issues/2)). Save As cannot create a new identity (P-06).
3. **The same data is stored twice.** `metadata.diagramIndex` repeats what the `tree` already says (name, type, parent folder). The two copies can disagree, and that disagreement is accepted today (F4c).
4. **Drafts carry no status.** `diagramTexts` holds the editor text, but the file does not say whether that text is a deliberately saved invalid draft or a valid source that should match the model. P-06 requires treating these two cases differently on open.
5. **The parser checks shapes, not references.** It does not check unique IDs or whether connector endpoints exist (F4a, F4b).

This ADR decides the file layout, how versions work, and the rule for each kind of input. It does not decide DSL identity syntax (A02.02), containment/message-order fields (A02.03), or recovery/history storage (A08).

## Decision

### 1. Envelope

A current-format (schema 2) file is a single UTF-8 JSON object:

```json
{
  "format": "uml-studio.project",
  "schemaVersion": 2,
  "writer": { "app": "UML Studio", "version": "0.1.0" },
  "project": {
    "id": "3f0c2a52-8a51-4d3e-9a0e-2a3c7f1d9b10",
    "name": "Order service",
    "createdAt": "2026-10-27T09:00:00.000Z",
    "updatedAt": "2026-10-27T09:30:00.000Z"
  },
  "tree": [
    { "id": "f-root", "type": "folder", "name": "Order service", "children": [
      { "id": "d-classes", "type": "diagram", "name": "Domain", "diagramType": "class" }
    ] }
  ],
  "diagrams": {
    "d-classes": {
      "model": { "id": "d-classes", "name": "Domain", "type": "class",
                 "elements": [], "connectors": [], "viewport": { "x": 0, "y": 0, "zoom": 1 } },
      "text": "@class-diagram \"Domain\"\n",
      "textStatus": "in-sync"
    }
  },
  "sharedElements": {}
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | yes | Must equal `"uml-studio.project"`. Identifies the file type; it never changes between versions. |
| `schemaVersion` | yes | Positive integer. The **only** value used to decide compatibility. |
| `writer` | yes | `app` and `version` (semver string) of the build that last wrote the file. **Informational only**: used in diagnostics and support reports, never to accept or reject a file. |
| `project.id` | yes | Stable project identity (UUID string). Keys device history and recovery. |
| `project.name`, `createdAt`, `updatedAt` | yes | Display name and ISO-8601 UTC timestamps. They do not take part in identity. |
| `tree` | yes | Folders and diagram entries. This is the only place a diagram's name, type and parent folder are stored. |
| `diagrams` | yes | Map from diagram ID to its document: `model` (last valid `DiagramData`), `text` (exact editor text) and `textStatus`. |
| `sharedElements` | yes | Kept from schema 1 unchanged (may be `{}`). Shared-element editing is still deferred. |

`metadata.diagramIndex` is removed. When the app needs an index, it derives one from `tree`, so the two can no longer disagree (this removes the cause of F4c).

### 2. Version policy

- `schemaVersion` is a single integer. Any change a schema-2 reader could misread (a new required field, a changed meaning, a removed field) increases it. A file is never "mostly compatible".
- A reader accepts exactly the versions it knows. Today that is **2** (current) and **1** (legacy, migrated in memory, §7). Any other value is refused before the rest of the file is read: *"This project was saved by a newer version of UML Studio (file format 3). Update the app to open it."* If the value is not a positive integer, the file is reported as damaged, not as a future version.
- Unknown keys are rejected in the envelope, `project`, tree nodes, diagram documents, elements and connectors. A newer writer that adds fields must increase the version, so an unknown key means a damaged file or a writer bug. The open `properties` bags on elements and connectors stay open (their type allows any keys), and unknown keys there are kept unchanged.
- The writer always writes the current version. Saving a file opened from schema 1 upgrades it. Writing an older version (downgrade) is not supported.
- An older build that only understands schema 1 will refuse a schema 2 file with "Missing required field: metadata". That message is unclear but safe; the old build cannot be changed afterwards.

### 3. Project identity

- A new project gets a fresh random UUID.
- Save and Open keep `project.id`. **Save As** writes a new `project.id` and leaves the source file and its history alone (P-06).
- Diagram, folder, element and connector IDs are not regenerated by Save As. They stay stable inside the copied project.
- A legacy file has no ID. Migration assigns a fresh ID in memory (§7). The ID generator is injected so that migration tests stay deterministic. The ID becomes durable on the first save. Until then, reopening the same legacy file produces a different ID, so device history for that unsaved project does not carry over. That is acceptable because the migrated project is open as unsaved. Existing history stored under the old `createdAt` + name key is left in place. A08 decides whether to offer importing it.

### 4. ID and reference rules

These apply to every accepted file, whichever version it came from:

| Rule | Example of a violation | Result |
| --- | --- | --- |
| Tree node IDs (folders and diagrams) are unique across the project | two folders `f-1` | reject |
| Every tree diagram entry has exactly one `diagrams[id]`, and every diagram is referenced exactly once in the tree | `diagrams.d-2` missing from the tree | reject |
| `diagrams[id].model.id === id`; model name/type equal the tree entry's `name`/`diagramType` | tree says `class`, model says `sequence` | reject |
| Element and connector IDs share one namespace and are unique within their diagram | two elements `Order` (F4a) | reject |
| Connector `sourceId`/`targetId` name an element in the same diagram | `targetId: "missing"` (F4b) | reject |
| Geometry is finite; sizes are positive; zoom is positive | `width: NaN` | reject |
| Limits from A01.10 (16 MiB of UTF-8, 20 diagrams) | 17 MiB file | reject before parsing JSON |

A rejection never replaces the active project or modifies the file on disk. The diagnostic names the diagram and field path where possible (for example `diagrams.d-classes.model.connectors[3].targetId`). Containment and message-order rules are added by A02.03/A03.05. Without the new fields, their checks are not part of this ADR.

### 5. Draft status

`textStatus` is the invalid-draft marker that P-05/P-06 require:

| `textStatus` | Written when | Checked on open |
| --- | --- | --- |
| `"in-sync"` | Editor text parsed successfully and `model` is the result | Re-parse `text`. Same meaning as `model` (comparison defined by A02.02) → open normally. **Different meaning** → stored text/model conflict: offer both candidates as unsaved copies (P-06); open neither silently. **Fails to parse** (for example, after a grammar change) → treat as `invalid`, with a notice. |
| `"invalid"` | Editor text did not parse; `model` is the last valid model (may be an empty diagram) | Open with the text as a marked draft. The canvas shows "Last valid diagram — fix text errors to edit". This is **not** a conflict. If the text now parses, still offer the conflict choice, because the draft may never have matched `model`. |

`text` is required, even when it could be generated from `model`. Keeping the exact text preserves comments and formatting.

### 6. Rule for each kind of input

The checks run in this order. The first one that fails decides the result:

1. Size limit → reject (*"File is larger than 16 MiB"*).
2. JSON syntax / top level not an object → reject as damaged, with line and column where available.
3. Version detection:
   - `format` present: it must be `uml-studio.project`, and `schemaVersion` must be a known integer. Otherwise reject: future version → "newer version" message; anything else → damaged.
   - `format` absent and `metadata.version` is a string: legacy. Major version `1` → **schema 1**. Any other major version (for example `999.0.0`, F4d) → refuse as an unknown future version.
   - Neither → reject (*"Not a UML Studio project file"*).
4. Shape and required fields for the detected version → reject with a field path.
5. ID/reference rules (§4) → reject.
6. Schema 1 only: migrate to a detached schema-2 copy (§7). An ambiguous result → recovery diagnostic, not a guess (A02.07).
7. Draft status (§5) → open, open with a marked draft, or start conflict review.

| Example input | Detected as | Result |
| --- | --- | --- |
| The §1 example | schema 2 | open |
| `{"metadata":{"version":"1.0.0",…},"tree":…,"diagrams":…}` without `diagramTexts` | schema 1 | migrate; text generated from the model, `in-sync` |
| schema 1 with `diagramTexts.d-1` that fails to parse | schema 1 | migrate; draft marked `invalid` |
| schema 1 with `diagramTexts.d-1` that parses to a different meaning | schema 1 | migrate; then conflict review |
| schema 1 whose state/use-case nesting cannot be recovered unambiguously | schema 1 | recovery diagnostic, no automatic save (A02.07) |
| `"schemaVersion": 3` | future | refuse: newer version |
| `"metadata": {"version": "999.0.0"}` (F4d) | future (legacy marker) | refuse: newer version |
| `"schemaVersion": "2"` or `2.5` | damaged | refuse: invalid schema version |
| `"format": "something-else"` | damaged | refuse: not a project file |
| schema 2 with an extra top-level key `"comments"` | damaged | refuse: unknown field `comments` |
| duplicate element ID (F4a), missing endpoint (F4b) | — | refuse at step 5 |
| schema 1 where `tree` and `diagramIndex` disagree (F4c) | schema 1 | refuse at step 4: legacy index inconsistent |

### 7. Legacy (schema 1) migration

Migration reads the parsed object and produces a **new** schema-2 object. The source bytes and the file on disk are never changed by Open (P-06, AC-14). The migrated project opens with "Converted from an older file format — save to update" and unsaved changes.

| Schema 1 | Schema 2 |
| --- | --- |
| `metadata.name`, `createdAt`, `updatedAt` | `project.name`, `createdAt`, `updatedAt` |
| `metadata.version` | dropped after detection (the writer value becomes the current app) |
| — | `project.id`: new UUID (injected generator) |
| `metadata.diagramIndex` | checked against `tree` (must agree exactly), then dropped |
| `tree` (including `expanded`) | `tree` unchanged |
| `diagrams[id]` | `diagrams[id].model` |
| `diagramTexts[id]` (optional) | `diagrams[id].text`; status per §6 examples |
| no `diagramTexts[id]` | `text` = DSL generated from `model`; `in-sync` |
| `sharedElements` | `sharedElements` unchanged |

## Consequences

- F4a–F4d become ordinary rejection tests in A03.08. Their `it.fails` markers are removed in that task, not here.
- Issue #2 is resolved by keying history on `project.id` (A02.04/A08). Copies made with Save As no longer share history. Copying the file outside the app still duplicates the ID; detecting that needs the destination path and belongs to A08.
- Files written by this build will not open in builds that predate A02.04. Release notes for that version must say so.
- Rejecting unknown keys makes new optional fields cost a version increase. That is deliberate: it is the simplest rule that keeps a file from silently losing data written by a newer app.

## Alternatives considered

- **Semver `schemaVersion` with "minor versions are compatible".** Rejected: nothing currently needs it, and it would require rules for which unknown fields to ignore and preserve.
- **Using the app version for compatibility.** Rejected: that is what made `metadata.version` meaningless. App and schema versions change for unrelated reasons.
- **Keeping `diagramIndex` as a cache for lazy loading.** Rejected: lazy loading is deferred (product specification coverage table, row 6), and a redundant copy creates a failure mode (F4c).
- **Deriving a legacy project ID by hashing the file content.** Rejected: copies of the same legacy file would still share one ID, which is the bug in issue #2.
