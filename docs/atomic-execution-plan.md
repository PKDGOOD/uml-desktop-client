# Public alpha atomic execution plan

Status: **execution started, 2026-09-27; 145 leaf tasks**. The [execution ledger](execution-status.md) records each completed or active task and its evidence. Unlisted tasks remain **Planned**. The plan itself is not completion or publication evidence.

[한국어 실행 계획](ko/atomic-execution-plan.md) · [Product specification](product-spec.md) · [Milestones](public-alpha-plan.md)

## How to execute this backlog

The former A01–A14 slices are **work packages**, not single PRs. IDs such as `A07.01` identify executable leaf tasks. Each row has one reviewable outcome, direct prerequisites, a product/acceptance reference, and evidence required for completion. Tests and the behavior they protect belong in the same implementation task; avoid a PR that knowingly breaks the default branch and relies on a later PR to repair it.

An atomic task changes one contract or produces one evidence artifact. It may touch a parser, engine and UI together when those changes are inseparable. It must be independently reviewable and safely revertible in its dependency order. It is not defined as one function, one file or one commit.

- **S:** 1–2 focused engineering hours; **M:** 2–4; **L:** 4–8, including the row's focused verification. These are planning bands, not measured durations or agent execution promises. An L task that reveals more than one outcome or more than a day's work must be split into `.a`, `.b` children before implementation; update every dependent ID.
- One active implementation task by default. Prefer one leaf per PR; combine only inseparable changes with one acceptance outcome. A code-review-only refactor, unrelated bug fix or dependency family gets a separate task.
- Read the current behavior first. If a requirement already works, attach fresh evidence and close the task without rewriting it. A previously checked checklist is not evidence. New regressions found during acceptance get linked leaf tasks; the failed acceptance remains open until the fix and rerun pass.
- **Ready** means all direct prerequisites are Done, relevant decisions/fixtures exist and required runtime/access is available. **Blocked** records the specific missing input and which independent tasks remain ready. State progression: Planned → Ready → In progress → Review → Done; record Blocked where necessary.
- Owner defaults to the implementer, with maintainer review. Rows marked **Maintainer** involve repository settings, accounts, pilot coordination or publication decisions; they do not assume those resources or permissions already exist. This planning request does not execute those actions.
- Existing uncommitted changes must be inventoried and preserved before implementation. Use dependency-order reverts; retain original project files and migration fixtures. Never revert persisted user files to simulate a code rollback.

### Completion record for each task

Copy this into the implementation issue/PR (no issue or PR has been created by this document):

```text
ID / state / implementer / reviewer:
Product requirement and acceptance scenario:
One outcome and explicit exclusions:
Direct dependencies and their evidence:
Affected files (new paths explicitly labeled):
Verification command or manual steps; actual output/result; commit and OS/build:
Compatibility / rollback note where relevant:
Remaining limitations or follow-up task IDs:
```

Done requires the outcome, targeted positive/negative checks, unchanged unrelated work and reviewable evidence. Run the repository's required `npm run check` and `npm run build:app` for an implementation PR; desktop changes additionally need the relevant packaged path. Documentation-only tasks use `npm run repo:check` and `git diff --check`. Test counts alone do not close a persistence or UX acceptance scenario.

Every newly introduced privileged operation, including history/recovery storage, must use A06.01's caller/payload policy and approved identity boundary. Do not treat finishing the initial IPC task as permission to add unvalidated channels later.

### Dependency notation and gates

`—` means no leaf dependency. `A05.*` means **all leaves currently listed under A05**, not one arbitrarily chosen task. Wildcards are used only for integration gates. All dependencies are direct; their transitive prerequisites still apply. A01–A14 order is a grouping convention, not a strict waterfall: for example, protected conflict handling waits for the history writer in A08.

| Gate | Required evidence | Work allowed afterward |
| --- | --- | --- |
| G0 Local baseline | A01.01–A01.11 Done; local failing reproductions are documented, not silently ignored | Model, persistence and UI leaves whose own dependencies are ready; private remote CI can proceed separately |
| G1 Document integrity | A02.*, A03.*, A04.* Done; F1–F4 regression outcomes green | Claim the supported document transformations preserve meaning; continue integration checks |
| G2 Integrated alpha candidate | A01.*–A12.* Done; all implementation gaps closed | Final A13 acceptance campaign |
| G3 Release candidate | A13.* plus A14.01–A14.05 Done | Independent user pilot on the exact distributable candidate |
| G4 Publication decision | A14.09–A14.11 Done | A14.12 source publication and/or A14.13 binary publication, only for the explicitly selected scope |

“Done” for a reproduction task means the failure is reproduced and recorded, not fixed. G1/G2 require its linked implementation fixes. G2/G3 must be reconsidered whenever their code/dependencies or artifact contents change; rerun affected evidence and the final smoke sequence on the new candidate.

## A01 — Baseline and reproducible failures (M0)

Surfaces: working tree, `docs/reviews/`, `examples/`, `scripts/`, `.github/workflows/ci.yml`, existing `*.test.ts`. Any new fixture/harness/evidence path below is a proposed artifact, not an existing tool. Excludes fixing model behavior.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A01.01 | Inventory and preserve current tracked/untracked work; propose commit boundaries without discarding changes | — | AC-15 | S | Sanitized file/change manifest and recoverable local backup; unrelated work explicitly identified |
| A01.02 | Capture the exact local baseline on Node 24 | A01.01 | AC-15 | M | Commit/dirty-state fingerprint, check/build/notices/package commands and actual results; failures listed without a readiness claim |
| A01.03 | Record alpha scope, support assumptions and current/target D-01–D-05 capability matrix | A01.02 | P-01, D-01–D-05 / AC-01, AC-11 | M | Every advertised operation marked working, failing or unverified; exclusions and open resource decisions recorded |
| A01.04 | Add a synthetic five-type fixture corpus with expected semantics | A01.03 | D-01–D-05 / AC-11 | M | Class, sequence, boundary, activity and nested-state fixtures include Unicode/long labels and explicit expected ownership/order |
| A01.05 | Preserve the F1 property-loss reproduction | A01.02 | P-05 / AC-02 | S | Minimal input and command reproduce stereotype/visibility loss; expected retained values captured |
| A01.06 | Preserve the F2 containment reproduction | A01.02 | P-05 / AC-03 | S | `Active/Inside/Outside` fixture demonstrates the incorrect parent before a fix |
| A01.07 | Preserve the F3 invalid-property reproduction | A01.02 | P-04 / AC-04 | S | GUI command with an invalid member identifier demonstrates model/DSL disagreement |
| A01.08 | Preserve the F4 malformed-project acceptance cases | A01.02 | P-06 / AC-04 | M | Separate duplicate-ID, dangling-endpoint, tree/index and future-version cases record expected rejection |
| A01.09 | Preserve the F5 browser false-save reproduction | A01.02 | P-07 / AC-07 | S | Stubbed/canceled download request demonstrates dirty state being cleared without confirmed persistence |
| A01.10 | Choose initial input limits and reference machine from fixture measurements | A01.03, A01.04 | P-11 / AC-13 | M | Byte, nesting, count, geometry and raster limits plus machine/build/data sizes recorded; unsupported extremes reject safely in later tasks |
| A01.11 | Establish a packaged launch/create/save/restart/open smoke harness | A01.02, A01.04 | P-07 / AC-07, AC-15 | L | Repeatable supported-macOS procedure/harness captures artifact and actual file contents; known failures remain visible |
| A01.12 | Assemble reviewable baseline commits and make them available to private CI — Maintainer | A01.01, A01.02, A01.03 | AC-15 | M | Exact intended diff reviewed; baseline commit IDs recorded; no unrelated changes or visibility change |
| A01.13 | Verify the configured remote CI matrix on that baseline | A01.12 | AC-15 | M | Actual macOS/Windows/Linux run URLs and check names; setup failures resolved or separately tracked |

Keep known-failure fixtures outside the ordinary passing suite or use a supported expected-failure mechanism with an explicit issue/ID. Their fix task must turn them into ordinary passing regressions. Never hide failures with blanket skips or retries.

## A02 — Document contracts and migration (M1)

Surfaces: `src/types/index.ts`, `src/engine/projectSession.ts`, `src/parser/project/`; proposed ADRs under `docs/decisions/`. Excludes inspector UX and unrelated store replacement.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A02.01 | Decide the versioned project envelope and compatibility policy in one ADR | A01.03, A01.08 | P-06 / AC-14 | M | Schema/app version separation, project identity, invalid-draft marker, required fields and reject/migrate decisions have examples |
| A02.02 | Decide stable DSL identity and source-edit mapping in one ADR | A02.01, A01.05, A01.06 | P-04, P-05 / AC-02, AC-03 | M | Rename, duplicate names, escaping, source spans and ambiguous-edit behavior specified with expected before/after examples |
| A02.03 | Add explicit containment and message-order fields to the domain model | A02.01 | P-04, D-02, D-03, D-05 / AC-03, AC-06 | M | Types and detached fixtures represent nested ownership and stable message order without array-order inference |
| A02.04 | Read/write the new project envelope without wiring unsafe UI replacement | A02.01, A02.03 | P-06 / AC-14 | L | New-format round trip preserves IDs, raw drafts, last valid state and presentation metadata |
| A02.05 | Represent raw draft, last valid model, diagnostics and revision in one session boundary | A02.04 | P-05 / AC-05 | L | Detached save snapshot cannot mutate live state; valid/invalid transitions and revision ownership are demonstrated |
| A02.06 | Migrate unambiguous legacy files into detached new-format copies | A02.04, A01.04 | P-06 / AC-14 | L | Migration is deterministic for fixtures, leaves source bytes unchanged and handles optional old draft fields |
| A02.07 | Reject ambiguous legacy containment with a recovery diagnostic | A02.06, A01.06 | P-06 / AC-03, AC-14 | M | Ambiguous old input cannot be silently reassigned or auto-saved; unaffected current project remains intact |
| A02.08 | Wire the new codec into session save/open snapshots | A02.05, A02.06, A02.07 | P-06 / AC-14 | M | Existing supported file workflows use the codec; current and legacy fixtures reopen with expected content |

## A03 — Shared validation boundary (M1)

Surfaces: parser/project adapters, `SyncEngine`, `ProjectSession`; proposed pure validators under `src/engine/`. Every validator returns structured diagnostics rather than mutating input.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A03.01 | Validate envelope shape/version and bounded primitive values | A02.04, A01.10 | P-06, P-11 / AC-04, AC-13 | M | Future versions, oversized/deep input and non-finite geometry are rejected before costly processing |
| A03.02 | Validate document identities and project-tree references | A03.01 | P-06 / AC-04 | M | Duplicate IDs, missing/duplicate tree entries, index mismatches and dangling endpoints identify the offending field |
| A03.03 | Validate property names, member fields and multiplicity using DSL-compatible rules | A02.02 | P-04 / AC-04 | M | Blank/invalid identifiers and invalid ranges rejected; quoted Unicode display names survive accepted input |
| A03.04 | Validate connector/element compatibility against D-01–D-05 | A03.02, A01.03 | P-03, D-01–D-05 / AC-04, AC-06 | M | Wrong diagram kinds, invalid relationship ends, self-links and unsupported notation produce explicit errors |
| A03.05 | Validate explicit ownership and containment cycles | A02.03, A03.02 | P-04 / AC-03, AC-04 | M | Missing/wrong parents, self-parenting and cycles rejected; external siblings remain independent |
| A03.06 | Apply the shared validators after DSL parsing | A03.03, A03.04, A03.05 | P-05 / AC-04, AC-05 | M | Syntax/semantic/unsupported diagnostics retain raw text; invalid parse results never replace last valid model |
| A03.07 | Apply the same validators before accepting GUI commands | A03.06, A01.07 | P-04 / AC-04 | M | F3 becomes a passing regression; invalid command changes neither revision nor undo history |
| A03.08 | Validate the entire project before opening/replacing a session | A02.08, A03.01, A03.06, A01.08 | P-06 / AC-04, AC-14 | M | F4 cases rejected; failure does not partially replace project/tree/tabs; unsupported fields are not silently dropped |
| A03.09 | Detect and resolve stored valid-text/model disagreements as unsaved candidates | A03.08 | P-06 / AC-14 | L | Both candidates validated, explicit choice/cancel works, original preserved; marked invalid drafts are not false conflicts |

## A04 — Lossless synchronization and history (M1)

Surfaces: `src/parser/dsl/uml.pegjs`, `peggyParser.ts`, `serializer.ts`, `src/engine/syncEngine.ts`, `projectSession.ts`, `undoManager.ts`, `DSLEditor.tsx`. Excludes wholesale formatting and new UML notation.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A04.01 | Capture AST/source spans and trivia needed for targeted edits | A02.02, A03.06 | P-05 / AC-02 | L | Parsed spans correctly locate nodes/members/links around comments, escapes and Unicode |
| A04.02 | Preserve identity and references across rename/text edits | A04.01, A02.05 | P-04, P-05 / AC-02, AC-06 | L | Names change without new IDs or dangling links; ambiguous mapping is diagnosed without mutation |
| A04.03 | Centralize DSL string/identifier escaping for supported fields | A04.01, A03.03 | P-04, P-05 / AC-02, AC-04 | M | Display names, quotes, slashes and Unicode round-trip; unsupported member names fail before serialization |
| A04.04 | Patch class properties/members without dropping supported data | A04.02, A04.03, A01.05 | P-05, D-01 / AC-02 | L | F1 ordinary regression passes; stereotype/visibility/members/comments/layout retained through save/open |
| A04.05 | Patch relation endpoints, labels and multiplicity in place | A04.02, A04.03, A03.04 | P-05 / AC-02, AC-06 | L | Parallel connections keep identity/direction; unrelated text and properties remain unchanged |
| A04.06 | Patch element/link insertion and deletion without full regeneration | A04.04, A04.05 | P-03, P-05 / AC-06 | L | Add/delete preserves unaffected comments and draft regions; unsafe transformation rejects without partial changes |
| A04.07 | Parse/serialize explicit containment without sibling reassignment | A04.01, A04.02, A03.05, A01.06 | P-05, D-03, D-05 / AC-03 | L | F2 ordinary regression passes for nested states and use-case boundaries; array reorder does not change parents |
| A04.08 | Preserve editable sequence-message order in DSL and model | A04.05, A02.03 | D-02 / AC-06, AC-11 | M | Reordering changes text/model order consistently while preserving message IDs and labels |
| A04.09 | Preserve invalid drafts and gate canvas mutations | A02.05, A03.06, A04.06 | P-05 / AC-05 | M | Invalid paste remains editable/recoverable; last valid canvas labeled; model commands blocked until correction |
| A04.10 | Unify per-diagram text/canvas undo transaction ordering | A04.06, A04.07, A04.08, A04.09 | P-03 / AC-05, AC-06 | L | Invalid text undo, 50 edit groups, gesture boundaries and redo invalidation pass without cross-diagram leakage |
| A04.11 | Preserve and dispose per-diagram sessions across tab/project changes | A04.10 | P-02 / AC-05 | M | Tab close/reopen retains draft/history; new project clears stale selection/clipboard and pending callbacks |

## A05 — Atomic editing commands and inspectors (M1/M4)

Surfaces: `PropertyPanel.tsx`, `UMLCanvas.tsx`, `elementFactory.ts`, `clipboardManager.ts`, `SyncEngine`; proposed connector-inspector components. A field is supported only when validation and synchronization exist.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A05.01 | Introduce buffered element forms with Apply/Cancel | A03.07, A04.04, A04.10 | P-04 / AC-02, AC-04 | M | Typing creates no model command; valid Apply is one undo step; invalid field focuses an error; Cancel restores prior values |
| A05.02 | Resolve pending form edits before changing selection or invoking Save | A05.01 | P-04 / AC-04, AC-07 | M | Apply/Discard/Cancel outcomes retain the right selection/document; save cannot bypass invalid pending input |
| A05.03 | Complete class-member/parameter/enum-value editing | A05.01 | P-04, D-01 / AC-02, AC-11 | L | Add/edit/remove/reorder supported members through form, text, undo and reopen without signature loss |
| A05.04 | Add connector selection and endpoint/label inspector | A05.01, A04.05 | P-04 / AC-06 | M | Endpoint names/direction are readable; accepted edits undo; incompatible endpoints retain original connection |
| A05.05 | Add applicable class multiplicity fields | A05.04, A03.03 | D-01 / AC-04, AC-11 | S | Only eligible relationship kinds expose fields; invalid ranges do not commit; both ends round-trip |
| A05.06 | Add sequence-message reorder control | A05.04, A04.08 | D-02 / AC-06, AC-11 | M | Moving one message updates order as one undoable edit with stable identity |
| A05.07 | Add explicit parent selection and transactional reparenting | A05.01, A04.07 | D-03, D-05 / AC-03 | M | Valid parent edit changes ownership/layout together; cycle/wrong kind rejected; undo restores both |
| A05.08 | Move container descendants as one canvas gesture | A05.07, A04.10 | P-03 / AC-03, AC-06 | M | All descendants move by the same delta; unrelated siblings do not move; crossing a border does not reparent |
| A05.09 | Enforce gesture-level move/resize transactions | A04.10, A03.07 | P-03 / AC-06 | M | Drag/resize creates one undo step, canceled gesture restores coordinates, finite size constraints enforced |
| A05.10 | Delete an element/subtree and incident links transactionally | A04.06, A04.07, A04.10 | P-03 / AC-06 | M | Container confirmation lists impact; undo restores complete subtree and links; cancel changes nothing |
| A05.11 | Copy/cut/paste graph selections with fresh identities | A05.10, A04.02 | P-03 / AC-06 | L | Container descendants/internal links copied; cross-type paste rejected; cut failure does not delete originals |
| A05.12 | Enforce the capability matrix in element/connector tools | A03.04, A04.06 | P-03, D-01–D-05 / AC-06, AC-11 | M | Valid source→target creates one link; Escape/invalid target creates none; unavailable notations are diagnosed/hidden |
| A05.13 | Verify bounded pan/zoom/fit navigation without document edits | A03.01, A04.11 | P-03 / AC-06, AC-12 | M | Zoom clamps to 25%–400%; fit includes all content; pan/fit/view changes preserve semantic content and leave undo ordering coherent |
| A05.14 | Complete consistent single/multi-selection for canvas objects | A05.04, A04.11 | P-03 / AC-06, AC-12 | M | Click/additive/marquee selection targets current objects; connector selection updates inspector; stale/hidden selections cannot mutate another diagram |

## A06 — Desktop file service and IPC (M2/M3)

Surfaces: `electron/main.ts`, `preload.ts`, `fileIO.ts`, `atomicWrite.ts`, renderer bridge types. Excludes signing and conflict UI. File handles are main-process-approved sessions, never arbitrary renderer paths.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A06.01 | Validate IPC sender/frame and operation payloads | A01.10, A02.01 | P-11 / AC-15 | L | Data-flow/caller boundary documented; wrong frame/caller, malformed/oversized payload and unexpected operation rejected with no privileged side effect |
| A06.02 | Replace renderer paths with approved document handles | A06.01, A03.08 | P-06, P-07 / AC-07, AC-15 | L | Dialog-approved handle opens/saves; fabricated, stale and other-window handles fail; no path escalation |
| A06.03 | Prove atomic file replacement failure behavior | A06.02 | P-07 / AC-07 | L | Permission/full-disk/interrupted temp write preserves original; cleanup/flush behavior documented and verified on supported OS |
| A06.04 | Serialize file writes and acknowledge the written revision | A06.03, A02.05 | P-07 / AC-07 | M | Delayed older save cannot overwrite a newer queued save; acknowledgment identifies exact snapshot revision |
| A06.05 | Detect external changes using a saved file fingerprint | A06.04 | P-07 / AC-08 | M | External modification/deletion/replacement returns conflict instead of overwriting; own successful write refreshes fingerprint |
| A06.06 | Implement protected explicit overwrite of a conflicted file | A06.05, A08.06 | P-07 / AC-08 | L | External version backed up before replacement; backup failure blocks overwrite; recheck detects changes after dialog display |
| A06.07 | Bound desktop import/export allocation at the privileged boundary | A06.02, A01.10 | P-11 / AC-13, AC-15 | M | Oversized file/raster requests rejected before allocation; current project and original destination remain intact |
| A06.08 | Return confirmed/canceled/failed results for image writes | A06.03, A06.07 | P-09 / AC-11 | M | Native save result distinguishes cancellation/failure/success without changing project dirty state |

## A07 — Save/open UI contracts (M2)

Surfaces: `src/App.tsx`, `ProjectSession`, `browserProjectFile.ts`, native bridge and proposed save/conflict components. Excludes automatic recovery internals.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A07.01 | Reflect acknowledged desktop save revisions in dirty state | A06.04, A05.02 | P-07 / AC-07 | M | New edits during save remain dirty; cancellation/failure never marks saved; no duplicate concurrent save race |
| A07.02 | Implement Save As as a successful fork of project identity/destination | A07.01, A02.08 | P-06, P-07 / AC-07, AC-14 | M | Success starts separate identity/history destination; cancel/failure retains original; both files reopen correctly |
| A07.03 | Replace browser false-save success with download-request state | A01.09 | P-07 / AC-07 | S | F5 ordinary regression passes; canceled/blocked download never clears dirty or claims confirmed persistence |
| A07.04 | Protect New/Open/close while work or form input is pending | A07.01, A07.03, A05.02 | P-02, P-07 / AC-05, AC-07 | M | Save/Discard/Cancel protect the original action; browser request alone cannot auto-continue leaving; failed save cancels close |
| A07.05 | Present external conflict Cancel/Save Copy/Reload/Overwrite choices | A06.06, A07.02, A08.06 | P-07 / AC-08 | L | Reload protects current work first; explicit overwrite protects external work; Save Copy forks; re-conflict is shown |
| A07.06 | Keep the active workspace intact on an unsuccessful Open | A03.09, A06.02, A07.04 | P-06 / AC-04, AC-14 | M | Invalid/canceled/failed open leaves tabs, drafts and destination intact; valid candidate activates once |
| A07.07 | Show distinct file, validation and recovery status | A07.01, A07.03, A08.04 | P-07, P-08 / AC-05, AC-07, AC-09 | S | Saved, Saving, Unsaved, Saved-with-errors, Download requested and Recovery unavailable cannot be confused |
| A07.08 | Clear obsolete document handles/state when replacing a project | A07.06, A04.11 | P-02, P-06 / AC-05, AC-14 | M | Old pending save completion cannot mark a new project saved; old handles and UI selection are released safely |

## A08 — Recovery and protected history (M2)

Surfaces: main-process storage adapter (new), `ProjectSession`, `localVersionStorage.ts`, `HistoryDialog.tsx`, `ProjectTree.tsx`; browser adapter (new where needed). Excludes rich snapshot diffs and cloud sync.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A08.01 | Add a durable versioned device-history store keyed by project ID | A02.08, A06.03 | P-08 / AC-09, AC-10 | L | Write/read/delete/index operations survive restart; existing local-history migration/export policy preserves originals |
| A08.02 | Enforce bounded retention without evicting protected history | A08.01, A01.10 | P-08 / AC-10 | M | Proposed 2 checkpoints/20 automatic snapshots/500 MiB policy measured; manual/latest protected data never silently pruned |
| A08.03 | Report and quarantine corrupt history/index records | A08.01 | P-08 / AC-10 | M | Corruption differs from empty history; valid records and original bytes remain recoverable; bad snapshot cannot replace session |
| A08.04 | Checkpoint accepted edits/raw drafts within two seconds | A08.02, A08.03, A02.05 | P-08 / AC-09 | L | Continuous edits do not starve writes; only acknowledged checkpoints advance time; failure visible; uncommitted form buffer excluded |
| A08.05 | Offer interrupted-session recovery as an unsaved copy | A08.04, A07.04 | P-08 / AC-09 | M | Recover/Keep for later/Delete paths tested after forced termination; original saved file is not overwritten |
| A08.06 | Create/list typed manual and protective snapshots | A08.02, A08.03 | P-08 / AC-10 | M | Description/time/type shown; validated document or external-file backup persists before caller mutates protected state |
| A08.07 | Restore a snapshot only after protecting current work | A08.06, A03.08 | P-08 / AC-10 | M | Invalid snapshot/backup failure aborts; success is unsaved and undo baseline is reset deliberately, not mixed with old document |
| A08.08 | Expose history usage and explicit snapshot/recovery deletion | A08.06, A08.05 | P-08 / AC-10 | M | On-this-device label and quota action visible; deletion impact confirmed; pinned protection cannot disappear automatically |
| A08.09 | Protect folder/diagram deletion with a pre-delete snapshot | A08.06, A08.07, A04.11 | P-02 / AC-10 | M | Impact count/cancel works; snapshot failure blocks deletion; Restore before deletion clearly restores the whole project |
| A08.10 | Retain browser evaluation drafts with truthful recovery status | A08.04, A07.03 | P-05, P-08 / AC-05, AC-09 | L | Browser storage/reload/denial/quota paths preserve acknowledged drafts or show unavailable status; no desktop durability claim inferred |

## A09 — Runtime containment (M3)

Surfaces: build scripts, Vite config, parser import, `electron/main.ts`, application HTML and worker loading. Excludes general authentication/backend work.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A09.01 | Compile the canonical Peggy grammar at build time | A01.02 | P-11 / AC-15 | M | Clean build deterministically generates parser; grammar corpus passes; runtime does not generate/evaluate grammar source |
| A09.02 | Apply a restrictive CSP compatible with local Monaco workers | A09.01 | P-11 / AC-15 | M | Packaged editor/workers function offline; prohibited execution/network cases fail; no blanket eval exemption |
| A09.03 | Constrain navigation and external-window creation | A06.01 | P-11 / AC-15 | M | Unapproved navigation/new windows blocked; allowed external links use explicit safe routing without renderer privilege |

## A10 — Dependency remediation (M3)

Surfaces: `package.json`, lockfile, audit evidence, notices and packaging. A named upgrade is scoped to one dependency family; determine actual versions from a fresh audit at execution time. Do not infer current vulnerability counts from older reports.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A10.01 | Produce a current runtime/build dependency disposition ledger | A01.02 | AC-15 | M | Audit includes shipped Electron; finding→reachable path→remediation/justified disposition→owner/review date recorded |
| A10.02 | Remediate the Electron dependency family | A10.01 | AC-15 | L | Reviewed compatible version or evidenced no-change disposition; native startup/IPC/file-dialog smoke passes |
| A10.03 | Remediate the Monaco/DOMPurify dependency family | A10.01 | AC-15 | M | Affected chain resolved or reachability disposition documented; editor/worker/IME smoke passes |
| A10.04 | Remediate the packaging/build-chain family | A10.01 | AC-15 | L | Packaging/audit finding resolved or evidenced disposition; clean install/build/pack works without forced blind upgrades |
| A10.05 | Re-audit the integrated dependency graph and close remaining findings | A10.02, A10.03, A10.04 | AC-15 | M | Every remaining high/critical item has a defensible result; new unrelated affected families become separate leaf tasks before closure |
| A10.06 | Regenerate and verify notices inside the packaged artifact | A10.05 | AC-15 | S | notices:check passes; root/dependency/Electron notices present and match the final locked versions |

## A11 — Canvas/export parity (M4)

Surfaces: `ElementRenderer.tsx`, `ConnectorRenderer.tsx`, `connectorGeometry.ts`, `exportEngine.ts`, export UI in `App.tsx`. Each notation row includes only that type's rendering and corresponding focused visual fixtures.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A11.01 | Capture one export revision and full-content bounds | A04.11, A01.10 | P-09 / AC-11 | M | Offscreen/negative-position content included; editing during export does not mix revisions; empty/oversized output rejected |
| A11.02 | Align class/enum member rendering between canvas and SVG | A05.03, A11.01 | D-01 / AC-11 | M | Class/interface/abstract/enum fixtures retain visible names, members, visibility and stereotype |
| A11.03 | Align class relationship notation and endpoint labels | A05.05, A11.01 | D-01 / AC-11 | M | Direction, inheritance/realization, diamonds and both multiplicities match canvas/export with readable parallel links |
| A11.04 | Render ordered sequence messages with sufficient height | A05.06, A11.01 | D-02 / AC-11 | M | Sync/async/return notation and visual/text order agree; no message clipped below lifelines |
| A11.05 | Render use-case boundaries and relationship notation consistently | A05.07, A11.01 | D-03 / AC-11 | M | External actors stay external; include/extend direction/labels and ownership match both representations |
| A11.06 | Render all advertised activity nodes/transitions consistently | A05.12, A11.01 | D-04 / AC-11 | M | Start/end/decision/fork/join/action visual fixtures and labeled transitions pass |
| A11.07 | Render nested state nodes/transitions consistently | A05.08, A11.01 | D-05 / AC-11 | M | Nested parent bounds, initial/final symbols and external siblings remain readable and correctly owned |
| A11.08 | Share multiline/Unicode text layout rules across outputs | A11.02, A11.03, A11.04, A11.05, A11.06, A11.07 | P-09 / AC-11 | L | Long signatures, escaped names and Korean labels at normal/high zoom are legible with documented font fallback |
| A11.09 | Add export format/scale/dimension/error controls | A11.01, A04.09, A06.08 | P-09 / AC-11 | M | Invalid active draft blocked; unrelated diagram errors do not block; scale/estimated dimensions visible |
| A11.10 | Verify standalone SVG artifact fidelity | A11.08, A11.09 | P-09 / AC-11 | M | Export opens outside app with all bounds/labels/notation; save cancel/error truthful and project remains dirty as appropriate |
| A11.11 | Verify PNG 1×/2× raster fidelity and write outcomes | A11.08, A11.09 | P-09 / AC-11 | M | Pixel dimensions and bounds match requested scale; limit/cancel/failure retains work; no false download success |

## A12 — Complete daily workflows (M4)

Surfaces: `App.tsx`, tree/tabs/dialogs/toolbar, `SplitView.tsx`, `DSLEditor.tsx`, `styles.css`, examples and help. Excludes recent files, advanced layout and new diagram types.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A12.01 | Provide an actionable no-project/no-diagram start surface | A07.04 | P-01 / AC-01 | S | New/Open/Examples discoverable; canceled/failed open leaves useful empty state; no fabricated recent content |
| A12.02 | Complete project→optional first-diagram creation flow | A12.01, A03.07 | P-01 / AC-01 | M | Required trimmed names and default class work; cancel second step retains usable empty project |
| A12.03 | Create folders with unique sibling names | A03.02, A04.11 | P-02 / AC-01 | S | Root/nested creation updates tree/index consistently; duplicate/blank name rejected without partial mutation |
| A12.04 | Rename folders/diagrams without breaking references | A12.03, A04.02 | P-02 / AC-05 | M | Tabs/index/tree agree; duplicate sibling name rejected; saved/reopened names and IDs remain consistent |
| A12.05 | Move folders/diagrams without cycles or duplicate tree entries | A12.03, A03.05 | P-02 / AC-04, AC-05 | M | Nested move preserves IDs/content; self/descendant move rejected; save/reopen maintains destination |
| A12.06 | Make tab close/reopen explicitly non-destructive | A04.11, A08.04 | P-02 / AC-05 | S | Closing dirty/invalid tab retains project draft; one tab per diagram; last tab closure offers useful empty state |
| A12.07 | Add navigable project diagnostics and last-valid-view explanation | A03.09, A04.09 | P-05, P-10 / AC-04, AC-05 | M | Severity/location/action shown; selecting an error opens its diagram and source; fixing it clears the correct diagnostic |
| A12.08 | Preserve editing state across split/text/canvas and narrow layouts | A05.04, A04.11 | P-10 / AC-12 | M | 1280×800 and 1024×768 fit; tree/inspector toggles and view changes preserve draft/selection/viewport |
| A12.09 | Scope shortcuts to the focused editing surface | A04.10, A05.02, A07.04 | P-03, P-10 / AC-06, AC-12 | M | Native modifier labels; form typing cannot delete shapes; undo/copy/save/escape/fit behave consistently |
| A12.10 | Preserve Korean/Unicode IME composition in forms and editor | A12.09, A05.03 | P-10 / AC-12 | M | In-progress composition neither commits invalid model changes nor triggers global shortcuts; final text round-trips |
| A12.11 | Make dialogs/property forms keyboard and screen-reader operable | A05.07, A07.05, A08.08, A11.09 | P-10 / AC-12 | L | Labels, tab order, error text, focus trap/return and Apply/Cancel flows verified |
| A12.12 | Make tree/tab navigation keyboard and screen-reader operable | A12.05, A12.06, A08.09 | P-10 / AC-12 | M | Creation/navigation/rename/delete are reachable without pointer; focus returns predictably; canvas limits documented |
| A12.13 | Bundle offline supported-notation and shortcut help | A01.03, A12.09 | P-01, P-10 / AC-01, AC-12 | M | Help opens offline with actual supported commands, save/recovery differences and no implicit upload |
| A12.14 | Deliver the synthetic class+sequence order-service walkthrough | A12.02, A05.06, A11.04, A11.03 | P-01, D-01, D-02 / AC-01, AC-11 | M | Example creates independent unsaved copy; text/property/message edits and expected output documented |
| A12.15 | Deliver the use-case boundary walkthrough | A12.02, A11.05 | P-01, D-03 / AC-11 | S | Task/expected output exercise external actor, boundary ownership and include/extend |
| A12.16 | Deliver the activity walkthrough | A12.02, A11.06 | P-01, D-04 / AC-11 | S | Task/expected output exercise decision, fork/join, labels and all declared node kinds |
| A12.17 | Deliver the composite-state walkthrough | A12.02, A11.07 | P-01, D-05 / AC-03, AC-11 | S | Task/expected output distinguish nested and external states and explicit reparenting |
| A12.18 | Offer actionable errors and sanitized diagnostic copying | A07.07, A12.07, A08.03 | P-10 / AC-12, AC-15 | M | Failure says what is retained and next action; default copied diagnostics contain no paths, project text or private labels |
| A12.19 | Publish a tested quick-start with current screenshots in local docs | A12.13, A12.14, A12.15, A12.16, A12.17, A11.10, A11.11 | P-01 / AC-01 | M | A walkthrough run matches written steps and sanitized screenshots; current limitations and platform claims agree |

## A13 — Acceptance and measured quality (M5)

Surfaces: proposed acceptance harness/fixtures and evidence under `docs/reviews/`; code changes only in separately identified failing-behavior tasks. Verification here closes user scenarios across layers; it does not postpone targeted tests from earlier implementation tasks.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A13.01 | Measure documented responsiveness/open/save/export budgets | A01.10, A05.*, A07.*, A11.* | P-11 / AC-13 | L | Reference commit/machine/data and p95/latency/fps results recorded; a miss creates a scoped profiling/fix leaf |
| A13.02 | Validate supported capacity and graceful over-limit handling | A13.01, A06.07, A09.01 | P-11 / AC-13 | M | Typical/stress/over-limit corpus yields measured published limits; no destructive crash or unbounded allocation |
| A13.03 | Measure retained memory across session/history lifecycles | A04.11, A08.* | P-11 / AC-13 | M | Repeatable cycles, baseline/cache/history budgets and retained-growth trend recorded; leaks receive separate fixes |
| A13.04 | Run native save cancellation/failure/concurrency scenarios | A01.11, A07.* | P-07 / AC-07 | M | Packaged cancel, permissions, full disk, delayed concurrent edits and restart/reopen preserve originals and dirty truth |
| A13.05 | Run native external-conflict scenarios | A13.04, A07.05 | P-07 / AC-08 | M | Cancel/copy/reload/overwrite and file-changed-again paths preserve promised versions |
| A13.06 | Run forced-termination and corrupt/quota recovery scenarios | A01.11, A08.*, A07.07 | P-08 / AC-09, AC-10 | L | Acknowledged valid/invalid drafts restored; storage failures visible; original files never auto-overwritten |
| A13.07 | Run all five type workflows through packaged reopen and image export | A05.*, A07.*, A08.09, A11.*, A12.14, A12.15, A12.16, A12.17 | D-01–D-05 / AC-02–AC-06, AC-11, AC-14 | L | Five fixture records each show create/edit/connect/copy/undo/save/restart/open/export and semantic/image comparisons |
| A13.08 | Record keyboard/IME/screen-reader and window-size acceptance | A12.08, A12.10, A12.11, A12.12, A12.18 | P-10 / AC-12 | M | Actual walkthrough and visual evidence for both sizes; limitations explicit; task-blocking failures remain open |
| A13.09 | Verify clean install and offline operation of an unsigned candidate | A09.*, A10.*, A12.13, A13.07 | P-11 / AC-15 | M | Fresh environment install/start/edit/save/export works with network unavailable; no hidden runtime asset downloads |
| A13.10 | Execute privileged-boundary negative tests against the package | A06.*, A09.*, A10.* | P-11 / AC-15 | M | Caller/handle/navigation/payload failures contained; current audit dispositions apply to packaged versions |
| A13.11 | Run ten consecutive final smoke cycles without masking failures | A01.*, A02.*, A03.*, A04.*, A05.*, A06.*, A07.*, A08.*, A09.*, A10.*, A11.*, A12.*, A13.01, A13.02, A13.03, A13.04, A13.05, A13.06, A13.07, A13.08, A13.09, A13.10 | AC-01–AC-15 | M | Ten runs on the same final candidate pass; a fix resets the sequence; no retry-only green result |
| A13.12 | Assemble the acceptance coverage ledger for the candidate | A13.11 | AC-01–AC-15 | S | Every P/D/AC maps to actual evidence and remaining pilot requirement; no known blocking defect or unexplained skipped scenario |

## A14 — Pilot and publication (M6)

Surfaces: publication/release policies, GitHub settings and supported distribution. These are distinct local evidence, maintainer decisions and publication actions. Source-only and supported-binary gates remain separate.

| ID | One outcome / boundary | Depends on | Contract | Size | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| A14.01 | Verify a usable private security/conduct reporting route — Maintainer | A01.03 | AC-15 | S | Actual private channel tested with benign content; documented contact and access work before publication |
| A14.02 | Review publishable history, secrets and asset/license provenance — Maintainer | A01.12, A10.06 | AC-15 | M | Final tree/all-ref scan plus human history/author/provenance review recorded; no secrets included in reports |
| A14.03 | Configure repository review rules using actual CI check names — Maintainer | A01.13 | AC-15 | S | Rules/settings inspected; appropriate PR/check protections enabled without impossible solo self-approval |
| A14.04 | Produce a signed/notarized supported-macOS release candidate — Maintainer | A13.12, A10.06 | AC-15 | M | Accounts/certificates available; artifact version/hash/signature/notarization verified; otherwise binary release remains blocked |
| A14.05 | Install the signed candidate on a clean supported machine | A14.04 | AC-15 | M | Normal trusted installation, launch/save/reopen/export and packaged notices pass; no OS-protection bypass instruction |
| A14.06 | Observe pilot participant 1 using the exact candidate — Maintainer | A14.01, A14.02, A14.03, A14.05 | AC-01, AC-09, AC-11 | M | Unaided first-use timing, interruption recovery and sharing results; blockers recorded without invented user feedback |
| A14.07 | Observe independent pilot participant 2 — Maintainer | A14.01, A14.02, A14.03, A14.05 | AC-01, AC-09, AC-11 | M | Same protocol/candidate as participant 1; installation time separate; individual pass/fail and friction recorded |
| A14.08 | Observe independent pilot participant 3 — Maintainer | A14.01, A14.02, A14.03, A14.05 | AC-01, AC-09, AC-11 | M | Same protocol/candidate and individual outcome; no maintainer intervention counted as unaided success |
| A14.09 | Close pilot blockers and record release-scope readiness — Maintainer | A14.06, A14.07, A14.08 | AC-01, AC-09, AC-11 | S | All blockers linked to separate fixes and affected reruns; three successful independent users; changed candidate revalidated |
| A14.10 | Prepare versioned release notes, checksums and rollback instructions | A14.09, A13.12 | AC-15 | M | Exact artifact/commit/evidence linked; limitations, support matrix and data-compatible downgrade/recovery procedure stated |
| A14.11 | Record explicit go/no-go for source and binary independently — Maintainer | A14.01, A14.02, A14.03, A14.09, A14.10 | AC-15 | S | Decision names exact source/history/artifact scope; no unresolved destructive/supported-crash/reachable-high-critical issue |
| A14.12 | Publish the reviewed source scope when authorized — Maintainer | A14.11 | AC-15 | S | Chosen repository visibility/source ref verified externally; README/support routes accessible; final exposure scan refreshed |
| A14.13 | Publish the approved signed binary when authorized — Maintainer | A14.11, A14.12 | AC-15 | S | Uploaded hashes/signature match approved artifacts; download/install verified; release can be withdrawn without deleting user files |

If signing resources are unavailable, local/source work can continue. Do not mark A14.04–A14.09 Done or advertise a supported binary. A source-only experimental release requires an explicit revised gate/scope record; it cannot silently inherit this supported-binary pilot's evidence.

## Start order and scheduling

Start A01.01 → A01.02 → A01.03. Then build A01.04–A01.11 evidence; the F1/F2/F3/F4/F5 reproductions can be completed independently after A01.02. A01.12/A01.13 are separate private-CI operations. Once G0 is ready, prioritize A02 → A03 → A04 for data preservation; A06.01 and A09.01/A10.01 can proceed when their direct dependencies are ready.

The persistence integration path is A02.08 → A06.02–A06.04 → A08.01 → A08.06 → A06.06 → A07.05. Recovery UI depends on basic close protection; conflict UI depends on the protective snapshot writer. Do not impose the old A07-before-all-A08 package order, which would introduce a false dependency cycle.

The first UI vertical slice is class property edit → preserved DSL → save → restart/open. Build A05.01/A05.03 and A07.01 around that slice after their prerequisites, then complete sequence/containment/other types. Independent work means dependency-ready work, not automatic multi-agent delegation. Edits sharing `SyncEngine`, the grammar, `App.tsx` or the lockfile should be serialized unless an explicit integration plan exists.

There are 22 S, 94 M and 29 L tasks. Assuming every leaf needs to be performed, their bands sum to **326–652 focused engineering hours** before review/fix iteration and external wait time. This is an initial workload envelope, not a measured forecast; existing functionality may close through verification instead of implementation.

The old 25–38-day estimate was made before this decomposition and is **superseded as a scheduling basis**. Recalculate from ready tasks after A01.03/A01.10, account for already-working features with evidence, and add explicit review/fix/pilot/account wait time. Do not treat the sum as an elapsed-time promise. Acceptance failures may introduce new scoped leaves.

## Coverage and exclusions

| Product scope | Primary work packages | Acceptance |
| --- | --- | --- |
| P-01 onboarding | A12.01–A12.02, A12.13–A12.19, A14.06–A14.09 | AC-01 |
| P-02 tree/tabs/protected close/delete | A04.11, A07.04, A07.08, A08.09, A12.03–A12.06 | AC-05, AC-10 |
| P-03 canvas/undo/clipboard/navigation/selection | A04.10, A05.08–A05.14, A12.09 | AC-06, AC-12 |
| P-04 properties/relations | A03.03–A03.07, A05.01–A05.07 | AC-02–AC-04, AC-06 |
| P-05 text fidelity/drafts | A02.05, A04.*, A12.07 | AC-02–AC-05 |
| P-06 file portability/migration | A02.*, A03.08–A03.09, A07.02, A07.06 | AC-04, AC-14 |
| P-07 save/conflicts | A06.*, A07.* | AC-07, AC-08 |
| P-08 recovery/history | A08.* | AC-09, AC-10 |
| P-09 export | A11.* | AC-11 |
| P-10 input/accessibility/errors | A12.08–A12.13, A12.18 | AC-12 |
| P-11 limits/privacy/offline | A01.10, A06.01/A06.07, A09.*, A10.*, A13.01–A13.03/A13.09–A13.10 | AC-13, AC-15 |
| D-01 class / D-02 sequence | A04.04/A04.08, A05.03–A05.06, A11.02–A11.04, A12.14 | AC-02, AC-06, AC-11 |
| D-03 use case / D-05 state | A04.07, A05.07–A05.08, A11.05/A11.07, A12.15/A12.17 | AC-03, AC-11 |
| D-04 activity | A05.12, A11.06, A12.16 | AC-11 |

The specification-driven API/contract-test product milestone remains outside this alpha backlog. Its discovery scope is in [the product specification](product-spec.md#10-next-product-milestone-specification-driven-development); do not silently add it to A01–A14 or the alpha estimate.
