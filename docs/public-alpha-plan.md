# Public alpha execution plan

Status: implementation started, 2026-09-27. See the [execution ledger](execution-status.md) for actual completed work. This milestone plan does not mark the remaining work complete or authorize a public release by itself.

The [product specification](product-spec.md) ([한국어 기획안](ko/product-spec.md)) defines users, scenarios, screens, supported features and interaction rules. Read it before implementing this plan. Its P-01–P-11 and D-01–D-05 requirements map to AC-01–AC-15 acceptance scenarios and the A01–A14 slices below. This document defines how to deliver that product; neither draft is a claim of completed implementation.

Execute through the [145 atomic tasks](atomic-execution-plan.md) ([한국어 실행 계획](ko/atomic-execution-plan.md)). A01–A14 below are work packages, not individual PRs. The leaf plan is authoritative for task dependencies, boundaries and completion evidence.

## Target outcome

A developer unfamiliar with the project can install it, understand its supported UML subset, create a diagram, edit it in text and canvas, save it, restart, reopen it without semantic loss, and export a readable image. Other developers can reproduce problems and contribute fixes through a working CI/review process.

The first release is a **usable public alpha**, not a UML-standard certification, an enterprise-supported application, or a specification-driven code-generation platform. Position the product as **local text-and-canvas UML editing with transparent, portable project files**. Lead with reliable round trips and a complete small-project workflow, rather than the number of tools on the toolbar.

Baseline evidence: [known limitations](known-limitations.md), [product review](reviews/2026-09-26-commercial-readiness.md), and [repository preparation](reviews/2026-09-26-open-source-readiness.md). Existing unit tests and macOS package checks are useful foundations, not release approval.

## Proposed scope

### Required for the first public alpha

- New/open/save/save-as projects; diagram/folder creation, rename, movement and recoverable deletion.
- A documented subset of all five existing diagram types, with a capability table covering create, edit, connect, serialize, reopen and export. Unsupported notation must be unavailable or diagnosed explicitly.
- Class and sequence diagrams as the primary onboarding examples; use case, activity and state examples covering their advertised subset.
- Text/canvas synchronization with explicit parse/semantic diagnostics, stable identity, preservation of supported properties, containment, comments and layout.
- Usable element **and connector** property editing: names, members/parameters, labels, endpoints, multiplicity and notation where supported. Changes must be undoable.
- Safe persistence, clear dirty/save/recovery states, crash recovery, external-file conflict handling and bounded snapshot storage.
- SVG/PNG with correct supported notation, text, labels, bounds and scale.
- English default UI/help, Unicode names and Korean/IME input, accessible forms and navigation, coherent keyboard shortcuts and visible focus.
- Reproducible source install, actual GitHub CI, security triage, issue/support routes and honest release notes.

### Platform policy

Start the supported **desktop binary** matrix with macOS Apple Silicon, where local packaging has been exercised. Confirm this scope in milestone 0. Source CI still runs on macOS, Windows and Linux; Windows/Linux desktop releases require their own native-dialog/recovery/package evidence before being advertised as supported. Browser mode remains a clearly labeled evaluation/development mode until its persistence and recovery checks pass.

Source publication and distributing a signed application are separate gates. A signing/notarization account or certificate dependency can delay public binaries without forcing a misleading unsigned "supported installer". Users must not be asked to bypass OS protection as the normal installation path.

### Explicitly deferred

Cloud sync/accounts, real-time collaboration, AI generation, full UML metamodel coverage, plugin APIs, large-project lazy loading, PDF, elaborate auto-layout, shared-element editing, rich version diffs, recent files, alignment/distribution tools, custom connector routing, and spec-to-code/contract-test generation. Add them only after the base editor is demonstrably reliable. No feature in this list is needed to close the current data-loss findings.

## Implementation order and exit gates

The milestones describe delivery gates. Use the atomic plan's S/M/L bands for initial workload planning, then rebaseline in M0 against current working features and measured gaps. They are not elapsed-time promises or autonomous-agent execution estimates; review/fix iteration, cross-platform binaries and certificate/account lead times require separate allowances.

| Milestone | Work | Depends on | Required evidence to leave the milestone |
| --- | --- | --- | --- |
| M0 — Establish the release baseline | Review/split pending changes; capability table; release scope; fixture corpus; start CI and packaged smoke harness | None | Reproducible baseline commit; real CI results; F1–F5 failing reproductions; documented support matrix |
| M1 — Preserve document meaning | F1–F4; schema/identity/containment decisions; common semantic validation; lossless text/model editing and migration | M0 | Supported round trips preserve meaning and metadata; invalid/ambiguous documents cannot silently overwrite the last valid state |
| M2 — Save and recover reliably | F5; file-session service, confirmed save states, Save As, recovery journal, file conflicts, snapshot retention and recoverable deletion | M1 | Packaged restart/reopen and injected failures preserve originals; recovery meets the explicit durability contract |
| M3 — Secure the desktop boundary | F6–F7; data-flow/caller boundary, approved document handles, IPC validation/limits, navigation/CSP, parser precompilation, dependency updates | M0; integrate against M1/M2 | Negative boundary tests and re-audit; no unmitigated reachable high/critical exposure; no silent audit suppression |
| M4 — Complete the editing experience | Core CRUD, connector editing, defaults/layout, shortcuts/IME/accessibility, export parity, onboarding | M1; persistence UI integrates with M2 | Each advertised diagram type completes the same end-to-end workflow; keyboard and visual review results recorded |
| M5 — Measure and stabilize | Representative performance corpus, memory lifecycle, error containment, end-to-end and visual regression matrix, clean-machine RC testing | M1–M4 | Published limits and measured budgets; zero unresolved release-blocking data-loss/crash/security issues within supported scope |
| M6 — Validate public delivery | External pilot, verified private reporting, GitHub rules, signing/notarization for binaries, release/rollback documentation | M5 | Pilot and release evidence attached to a specific commit; explicit go/no-go and publication decision |

The former 25–38-day / 6–10-calendar-week estimate predates the detailed product scope and is superseded as a scheduling basis. The 145 leaf-task bands sum to **326–652 focused engineering hours if every task needs to be performed**; this remains a rough workload envelope, not a delivery promise. Re-estimate after baseline verification and again after M1. Keep scope fixed rather than remove integrity checks to meet a date.

## M0: turn the audit into executable release criteria

- Preserve unrelated local work; organize existing product fixes, repository preparation and future fixes into reviewable commits/PRs. Do not merge unresolved baseline changes without recording what is included.
- Run existing checks on GitHub, including its OS matrix. Configure branch protections only after real check names exist.
- Build a reusable UI/packaged smoke harness early; do not postpone it to the final week. Start with launch → create → save → restart → reopen.
- Adopt or revise the product specification as the alpha scope baseline. Expand its D-01–D-05 capability contract into a current-versus-target checklist per element/connector type. The checklist drives UI availability, validation, serialization and exports; the proposed table is not evidence of support.
- Record file/DSL byte limits, maximum nesting, element/connector limits and raster pixel limits against reference fixtures before import/IPC work. Resolve the product specification's open decisions at their stated milestones.
- Add minimal reproductions for properties disappearing, containment changes, invalid GUI values, duplicate/unresolved IDs and incorrect browser save state. Preserve them as regression fixtures.
- Add real but synthetic class/sequence/usecase/activity/state examples, Unicode/escaped names, parallel links, nested containers, invalid drafts and older files. Do not use company designs.
- Confirm support platform, private reporting contact, maintainer availability and signing resources as explicit decisions rather than assumed capabilities.

## M1: document invariants before new features

Create a short architecture decision record before changing the schema:

1. Separate file `schemaVersion` from application version. Give projects, diagrams and elements stable IDs. Persist explicit ownership (`parentId` or an equivalent structure), validate parent existence/cycles, and never infer containment from array order.
2. Define a validated document state owned by `ProjectSession`, with the last valid model, raw draft, diagnostics and revision. React/Zustand may project UI state but must not independently mutate the authoritative document.
3. Use one semantic validation boundary for parsed text, imported files and accepted GUI commands. Keep form typing in a temporary buffer until commit so partially typed names do not create invalid model commands on every keystroke.
4. Decide how identity and source locations survive text edits and renames. Do not rely on names alone. Prefer structured edits against parsed source/AST ranges for canvas changes so comments and unaffected text are preserved. If a safe transformation cannot be performed, keep the original draft and report the limitation rather than regenerating destructively.
5. Define what happens when stored model and valid stored text disagree. Detect and present recovery choices; never silently select one and overwrite the other.
6. Migrate compatible old files into a detached copy, retaining originals. Files whose historic containment cannot be recovered unambiguously require a diagnostic/review path. Reject unsupported future formats with actionable messages.

Compare canonical semantics in round-trip tests, not byte equality of randomized IDs or formatting. Include stable IDs, supported properties, connector direction/multiplicity, nested ownership and presentation metadata in the appropriate invariants. Keep separate tests for preserving raw text/comments and invalid drafts.

## M2: a concrete persistence contract

- Desktop saves operate on a snapshot revision. A successful write marks **that revision** saved; concurrent edits remain dirty. Cancellation/failure never clears dirty state.
- Browser downloads remain "export/download requested" unless completion can be confirmed. Maintain a recoverable draft and communicate the difference; do not claim confirmed disk persistence.
- Main process manages document sessions and approved file handles. Record a file fingerprint and detect external changes before overwriting. Conflict offers save-copy/reload/explicit overwrite, with original protection and recoverable current work.
- Keep atomic replacement; validate interruption, full disk, permissions, encoding and OS-specific replacement behavior. Define crash durability/flush behavior rather than equating rename with power-loss guarantees.
- Store recovery data in durable device storage appropriate to each environment, with a stable project ID, revision and retention/quota policy. Proposal: checkpoint within 2 seconds after an edit and display the latest recovery time; recovery tests may lose only edits newer than that acknowledged checkpoint. File save and recovery checkpoint remain visibly separate.
- Restore is preceded by a recoverable backup. Folder/diagram deletion becomes undoable or recoverable through a trash/snapshot flow.
- Snapshot corruption and storage exhaustion produce actionable errors. Do not silently turn a corrupt history index into an empty history or allow unbounded localStorage growth.

## M3: security and dependency work

- Replace arbitrary renderer-supplied filesystem paths with main-process-approved document handles. Validate caller/frame, command schema, payload length, format/depth and permissions for every privileged operation.
- Block unexpected navigation/new windows; define a strict CSP compatible with locally bundled assets. Generate the parser at build time to avoid requiring unrestricted runtime evaluation where feasible.
- Bound file/DSL size, recursion, geometry, zoom and export raster dimensions. Reject unreasonable input before expensive rendering or large allocation; preserve the active project on failure.
- Re-audit at implementation time. Include Electron even though it is a devDependency. Upgrade reviewed groups with regression tests; regenerate license notices.
- A reachable high/critical issue is a release blocker. A tool-only or unreachable finding requires written evidence, owner and review date, not blanket suppression. Keep audit output honest.
- Use sanitized local diagnostics; do not add telemetry or upload project content as an implicit requirement of launch.

## M4: functional and visual quality

Use one acceptance checklist for each advertised type: create → name → edit properties → connect → move/resize → copy/paste → undo/redo → save/reopen → export.

- Class: members and parameters, visibility/stereotypes, relation direction and multiplicity, long signatures and Unicode.
- Sequence: lifeline alignment, message order and labels, supported sync/async/return notation, editable message sequence and sufficient diagram/export height. Explicitly defer frames/activations/self-messages if they are not implemented and validated.
- Use case: actor/use case association and supported include/extend; explicit system-boundary ownership.
- Activity: supported start/end, action, decision, fork/join and labeled transitions; no unsupported workflow semantics implied.
- State: initial/final states, transitions and validated composite containment.

Other requirements:

- New/Open/Save/Save As, rename, folder movement and recoverable deletion must be discoverable. Selection and clipboard must not leak stale state when changing project. Recent files are deferred by the product specification.
- Provide consistent empty/loading/saving/error/recovery states and a minimal shortcut help panel. No success notification without corresponding success evidence.
- Align canvas and exported notation: arrowheads, composition end, labels, visibility, multiline text, font selection, line wrapping, bounds and clipping. Use a shared rendering/layout specification where practical, avoiding divergent fixes in two renderers.
- Add visual fixtures at normal and narrow desktop widths; review large labels, high zoom, long forms, empty projects and failures. Test keyboard tab order, accessible field names, focus return from dialogs, contrast, IME composition, and a screen-reader walkthrough of forms/project navigation. Do not claim full accessibility conformance without a dedicated audit; document canvas limitations.
- Provide five walkthrough examples and a concise English quick-start with actual, sanitized screenshots taken from the release candidate.

## M5: measurable quality gates

These are **proposed targets**, not current measurements. In M0 record a reference machine, OS, build and dataset; measure before optimizing. If a target is unrealistic, change the documented scope/limit with evidence rather than silently skipping the measurement.

| Area | Proposed acceptance target |
| --- | --- |
| Integrity | No known destructive transformation in any advertised feature; F1–F5 regressions and migration corpus pass |
| Typical diagram | 200 elements / 300 connectors, 20-diagram project; report actual serialized size and history depth |
| Editing responsiveness | p95 command feedback under 100 ms; p95 text-to-canvas update under 500 ms after the existing debounce, on the reference fixture |
| Open/save | Typical project open and confirmed desktop save each under 2 seconds; export under 5 seconds at documented dimensions |
| Pan/zoom/drag | Target at least 30 fps on the typical fixture, measured rather than inferred from unit tests |
| Capacity | Stress 1,000 elements / 2,000 connectors to choose a published upper bound; graceful diagnostic/limit is acceptable outside the supported budget, a crash is not |
| Memory lifecycle | Repeatedly open/close projects and fill/clear undo histories; verify no sustained retained-growth trend beyond the stated cache/history budget |
| Persistence | Restart/forced-termination recovery, cancelled dialogs, read-only paths, full-disk simulation, malformed files and external edits have recorded outcomes |
| End-to-end | Supported platform's core scenario matrix passes; after the last fix, 10 consecutive smoke runs pass without retries masking failures |
| External usability | At least 3 fresh users each complete the core walkthrough within the proposed 15-minute target after installation, without maintainer intervention; record installation time separately and fix/retest every blocker |

Use workers, indexing, structural sharing, or rendering changes only when profiling identifies the bottleneck. Avoid introducing a new state-management architecture or lazy-loading system purely to appear more "enterprise".

## Work packages and atomic tasks

These are local planning packages, not single-PR boundaries or claims that GitHub issues/PRs already exist. Each leaf in the [atomic plan](atomic-execution-plan.md) is a proposed reviewable task; its direct dependencies replace the former package-level ordering.

| ID | Deliverable | Leaf tasks |
| --- | --- | --- |
| A01 | Product-scope baseline, current/target capability checklist, input limits, baseline commits, F1–F5 regression fixtures and smoke harness | A01.01–A01.13 |
| A02 | File schema/identity/containment ADR and migration scaffolding | A02.01–A02.08 |
| A03 | Shared semantic validation, safe imports and future-version rejection | A03.01–A03.09 |
| A04 | Lossless property/source synchronization and explicit containment round trips | A04.01–A04.11 |
| A05 | Committed property forms, connector commands, selection/navigation and coherent undo boundaries | A05.01–A05.14 |
| A06 | Desktop document handles, IPC schemas/limits and conflict-aware file service | A06.01–A06.08 |
| A07 | Confirmed save states, Save As and browser download-state correction | A07.01–A07.08 |
| A08 | Durable recovery, bounded snapshots and recoverable structural deletion | A08.01–A08.10 |
| A09 | Parser precompilation, CSP and navigation restrictions | A09.01–A09.03 |
| A10 | Reviewed dependency upgrades, audit disposition and regenerated notices | A10.01–A10.06 |
| A11 | Supported-notation rendering/export parity and visual fixtures | A11.01–A11.11 |
| A12 | Onboarding, keyboard/IME/accessibility and all-type workflow completion | A12.01–A12.19 |
| A13 | Performance measurements and packaged failure/recovery acceptance | A13.01–A13.12 |
| A14 | External pilot, release candidate evidence, publishing prerequisites and selected publication | A14.01–A14.13 |

A06/A09/A10 can be developed alongside later model work after their interfaces are agreed; their integration tests depend on the final model/persistence contract. Parallelizable work does not imply that separate agents or teams have been assigned.

## Release decision and pilot

Before broad announcement, run a small pilot with three independent users and synthetic projects. Ask each to install/start, create from an example, change both text and canvas, save, restart, recover an interrupted edit, and export. Collect observable failures rather than only satisfaction ratings.

The launch PR must link a specific release-candidate commit, actual CI runs, regression/E2E/visual/performance results, dependency/security dispositions, license/secret-scan evidence and pilot outcomes. An unresolved destructive bug, unrecoverable save failure, supported-path crash or reachable high/critical vulnerability means **no-go**. Cosmetic issues can remain only if documented and non-blocking.

Follow [publication](publication.md) for GitHub visibility/settings and verified private reporting. Follow [releases](releases.md) for signed binaries, checksums, support claims and rollback. Public visibility and release publication are explicit maintainer decisions after the evidence is reviewable.

## Beyond the first alpha

After stabilization, select one backend API use case for a separate specification-driven-development milestone: requirements and acceptance criteria → API/state contract → generated contract tests → CI drift detection. Assess it with a real pilot project before claiming spec-driven development support. Do not let this expansion delay fixing the editor's own information-preservation contract.
