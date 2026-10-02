# Commercial-readiness review — 2026-09-26

[한국어](../ko/reviews/2026-09-26-commercial-readiness.md)

Verdict: commercial release on hold. The app is usable for personal drafts, but it is not fit to be the only source of truth for an important design specification. This verdict is based on static code review, runnable engine reproductions, the existing tests, TypeScript/bundle builds and the official npm audit. This review did not modify product code.

## Verification

- npm test: 19 files, 284 tests passed.
- npm run build:app: TypeScript and the renderer/main/preload bundles succeeded.
- Runtime reproduction: the real SyncEngine, parseDSL, serializeDSL and ProjectFileParser were bundled with esbuild and run in Node.
- npm audit: 24 vulnerable package entries (1 critical, 18 high, 4 moderate, 1 low). Development/transitive dependencies must be separated from the shipped runtime; this does not mean 24 attack paths into the app were confirmed.
- Not run in this review: packaged-app save-and-reopen E2E, penetration testing, long-running/large-scale performance, per-OS install and update. An earlier manual reopen check was not completed either, so it is not counted as passing.

## Release-blocking defects

### F1 [P1] Text round trip loses user-edited properties — reproduced

Location: src/engine/syncEngine.ts:300, src/parser/dsl/serializer.ts:159, src/components/properties/PropertyPanel.tsx:33.

On an Order class, stereotype=entity and visibility=private were set with the same element-update command the GUI uses. Then one line break was added to the generated DSL and it was parsed. The resulting properties contained only name/attributes/methods. The serializer does not express these fields, and preserveIds restores only ID/sharedRefId. A trivial text edit loses model data.

Action: specify the information-preservation contract between the model and the DSL, and either serialize every supported field or explicitly merge fields the DSL cannot express. A model→DSL→model round-trip regression check over all properties is required. Comments are also dropped because GUI changes regenerate the whole DSL, so a preservation policy must be defined for them as well.

### F2 [P1] Composite-state containment changes — reproduced

Location: src/parser/dsl/uml.pegjs:67, src/parser/dsl/serializer.ts:404.

Input:

```text
@state-diagram "QA"
composite-state Active {
 state Inside
}
state Outside
```

After parse and serialize, Outside also ends up inside Active's braces. The parser flattens the hierarchy, and the serializer assumes every consecutive state in the array is a child. Use case boundaries have the same order-based structure.

Action: add parentId or explicit children/an AST to the model, with a file-version migration and hierarchy round-trip checks. This changes meaning, so it must not be treated as a mere display bug.

### F3 [P1] Property edits produce invalid DSL and hide the error — reproduced

Location: src/components/properties/PropertyPanel.tsx:54, src/engine/syncEngine.ts:237, :100.

Setting an attribute name to `bad name` makes onCanvasChange succeed and getErrors() return an empty array, yet the generated DSL fails parseDSL. restore clears errors without validating the generated result. On reopen, setDiagram parses and the error appears, so the same document behaves differently right after the edit and after reopening.

Action: separate transient form input from commits and run domain validation at the command boundary. Guarantee the invariant that every accepted GUI change produces valid DSL.

### F4 [P1] No validation of duplicate IDs, dangling connectors or file version — reproduced

Location: src/parser/project/projectFileParser.ts:140, :172, src/parser/dsl/uml.pegjs:84, src/components/canvas/ConnectorRenderer.tsx:110.

JSON with duplicate element IDs, nonexistent sourceId/targetId and metadata.version=999.0.0 passed parseAll. `A --> Missing` after declaring `class A` also parses successfully in the DSL. The canvas hides connectors with missing endpoints by returning null. Shape-level type validation does not guarantee semantic referential integrity, and there is no consistency check between the tree, diagramIndex and diagrams.

Action: use a shared semantic validator to check ID uniqueness, endpoint existence, allowed elements/relations per diagram type, tree/index agreement and supported versions. Reject unsupported future versions and migrate older ones explicitly.

### F5 [P1] Starting a browser download is treated as a successful save — confirmed in code

Location: src/App.tsx:407, src/engine/browserProjectFile.ts:2.

downloadProject returns right after the anchor click. App calls markSaved regardless of whether the download succeeded, so if the download is cancelled or blocked, the dirty flag is cleared and leave-page protection disappears. The native save path does not have the same completion problem.

Action: distinguish a download request from save completion. When browser save completion cannot be confirmed, keep a recovery draft and a warning, or offer a supported browser file API that can confirm the write completed.

## Security and operations release conditions

### F6 [P1] Electron file-access boundary needs hardening — confirmed in code, no attack reproduced

Location: electron/fileIO.ts:41, electron/preload.ts:24, electron/main.ts:9, index.html:3.

contextIsolation=true/nodeIntegration=false is appropriate. However, the IPC that reads and writes arbitrary paths passed by the renderer does not validate senderFrame/origin, approved paths or payload size. There is also no CSP and no navigation/new-window restriction. This alone does not mean an XSS exists today, but the boundary that would limit file-access damage after a renderer compromise is insufficient.

Action: validate trusted senders and the main frame, use only document handles approved by the main process, limit data size, and add a CSP and navigation policy. Precompile Peggy instead of generating it at runtime so it does not conflict with a strict CSP.

Reference: https://www.electronjs.org/docs/latest/tutorial/security

### F7 [P1] Dependency security updates and impact analysis needed — confirmed by npm audit

Electron 41.2.0 in the current lockfile is reported as high. Even though Electron is declared as a devDependency, it is the shipped app runtime. Monaco 0.55.1 and DOMPurify 3.2.7 are on production dependency paths. The critical tar entry is a transitive dependency of development tooling. Entries about Windows server/build paths in development tools should not be assumed to be remote vulnerabilities of an offline macOS app.

Action: classify by reachable attack path, update versions, run regression tests and re-audit the shipped artifacts. Do not blindly run npm audit fix --force.

## Further software-engineering gaps

- Recovery: beforeunload does not protect against forced quit or crashes. There is no automatic recovery draft, crash recovery, save-conflict detection or file locking. Atomic rename reduces partial writes but does not provide fsync, backups or protection against external changes.
- Snapshots: each one is a full project copy in localStorage with no size or retention policy. Identification by createdAt+name means duplicated projects can share history. VersionManager.loadIndex treats a corrupted index as an empty list. Durable storage, corruption recovery and distinct errors are needed.
- Architecture: extracting ProjectSession is good, but App manually synchronizes session, Zustand and React state. A central domain layer that validates the tree/index/model/DSL representations, plus command transactions, is needed.
- Performance: every change deep-clones the whole model JSON, each sub-command of a batch clones again, and undo stores full snapshots. Parsing also runs synchronously in the renderer. Large-document support cannot be claimed without document size limits and latency/memory measurements on representative large documents.
- Tests: all 284 current tests run in the node environment. The four engine reproductions in this review occurred in code that passed the existing tests. UI/IPC/real save-and-reopen tests, fault injection (disk full, permissions, corrupt files) and per-OS packaged E2E are needed. There is no .github CI, and no other external CI could be confirmed.
- Distribution: macOS signing is ad hoc, and notarization, updates, rollback and dependency license notice checks are not complete. Strict TypeScript and a successful build do not substitute for these.

## Proposed commercial approval criteria

1. Add the F1–F5 reproductions as tests, then pass meaning preservation and error rejection for every supported type.
2. Apply the F6–F7 security boundaries and document the vulnerability impact on the shipped runtime and build chain.
3. Pass save → quit → relaunch → open, restore, export, forced-quit recovery and external file-change conflicts in real packaged E2E.
4. Declare supported OSes, maximum document size and performance targets, and put CI, signing/notarization and release/rollback procedures in place.

The verdict is: commercial release on hold. Spec-driven development additionally requires requirements traceability, contract verification and detection of drift between implementation and specification. The first step is to make the diagram specification itself lossless.
