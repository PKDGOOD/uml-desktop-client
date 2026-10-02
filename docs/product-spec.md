# UML Studio public alpha product specification

Status: **draft 0.1, proposed product behavior**, 2026-09-26. This is a specification to implement and validate, not a description of completed functionality or approval to publish.

[한국어 기획안 안내](ko/product-spec.md) · [Execution plan](public-alpha-plan.md) · [Atomic tasks](atomic-execution-plan.md) · [Current limitations](known-limitations.md)

This document defines **who the product serves, what they can accomplish, and how it should behave**. The execution plan defines implementation order, dependencies, estimates and release evidence. Requirement IDs below connect the two. The original [requirements](../.kiro/specs/uml-desktop-client/requirements.md) remain historical context; this draft proposes a narrower first public release. If adopted, it becomes the alpha scope baseline. A change to scope must update this document and its acceptance scenarios before dependent implementation changes.

## 1. Product intent and users

**Product proposition:** a developer can describe a small software design in text, refine it visually, and keep an editable local project without losing information when switching between representations.

The primary user is an individual backend/application developer preparing a design for implementation or review. The secondary user is a technical reviewer who opens the project or reads its exported image. The alpha supports asynchronous sharing of files and images; it does not provide concurrent team editing.

These are product hypotheses derived from the intended workflow, not findings from completed user research:

| User problem | Proposed product response | Pilot evidence to collect |
| --- | --- | --- |
| A diagram is quick to draft but costly to revise in two separate representations | One text/canvas document with predictable synchronization | User edits both representations and can explain what changed |
| A design becomes unreliable if labels, properties or ownership disappear during editing | Preserve supported meaning, layout and original draft; show errors before accepting invalid changes | Compare the saved/reopened project with the user's intended design |
| A developer needs to hand a design to another person without an account or a service | Portable `.uml.json` project plus SVG/PNG; work offline after installation | A second user opens a shared file; a reviewer can read its image |
| An interrupted edit or failed save creates uncertainty about what was retained | Separate file-save and recovery status with explicit recovery actions | User finds their acknowledged checkpoint after a forced interruption |

The first successful session is: **start → create from an example → change text → change a property/connection → save → restart/open → export**. The proposed usability target is completion in 15 minutes by each of three new pilot users, without maintainer intervention after installation. Record installation time separately. This is a target to validate, not a measured result.

## 2. Scope and priorities

All `P-*` and `D-*` requirements in this document are **must-have for advertising the first public alpha's supported workflow**. Implement class and sequence first; all five types must meet their declared subset before the release advertises all five. A feature that fails its gate requires a documented scope change, not a silent exception.

| Priority | Scope |
| --- | --- |
| Alpha must-have | Local projects, folders/diagrams, supported five-type editing, text/canvas preservation, element and connector properties, undo/redo, safe open/save/Save As, recovery/history, SVG/PNG, English help, Unicode/IME, keyboard-accessible forms/navigation |
| After alpha stabilization | Recent files, richer comparison of versions, alignment/distribution tools, custom connector routing, additional notations and broader native-platform support |
| Separate product milestone | Requirements/API/state contracts linked to contract tests and CI drift detection; see section 10 |
| Outside this release | Accounts/cloud/collaboration, integrated AI, full UML compliance, PDF, code generation, plugin APIs, shared-element editing, lazy loading for large projects, elaborate auto-layout |

Proposed initial supported binary: macOS Apple Silicon. Windows/Linux source CI does not establish native-app support. Browser mode is labeled **evaluation mode** and follows the distinct download contract in `P-07`. Signing, reporting channels and final platform support remain release decisions listed in section 11.

### Diagram capability contract

For each row, “supported” means the user can create, select, edit, connect, copy/paste, undo, save/reopen and export the notation. Existing type declarations alone are not evidence of support. M0 must produce a measured current-versus-target capability checklist from this table.

| ID | Elements and connectors in alpha | Required editing behavior | Explicit exclusions |
| --- | --- | --- | --- |
| D-01 Class | Class, interface, abstract class, enum; association, directed association, dependency, inheritance, realization, aggregation, composition | Class names, stereotype, visibility; attributes and methods with parameters/types/visibility; enum values; relation labels and applicable endpoint multiplicity; clear direction and whole/part end | Arbitrary UML profiles, templates, executable constraints |
| D-02 Sequence | Lifelines; synchronous, asynchronous and return messages between distinct lifelines | Participant names, message labels/endpoints; explicit message order editable in properties and reflected in DSL; reorder is undoable; canvas/export height contains every message | Self-messages, activations, combined fragments, execution semantics |
| D-03 Use case | Actor, use case, system boundary; association, directed association, include, extend | Names, relation labels/direction; use case ownership selected explicitly; include/extend connect use cases; actors remain outside system boundaries | Automatic scenario generation or behavioral verification |
| D-04 Activity | Action, decision, fork, join, initial/final node; transitions | Names where applicable; transition labels; appropriate node shapes and connector ends; labels are plain text | Swimlanes, object flows, workflow execution or deadlock checking |
| D-05 State | State, composite state, initial/final state; transitions | Names, labels, explicit parent for states/pseudostates; nested composite ownership, no cycles; external siblings stay external | Orthogonal regions, history pseudostates, executable guards/actions, self-transitions in alpha |

Common restrictions: connectors remain within their diagram; self-links are unavailable in this alpha; class inheritance/realization and use-case include/extend must use compatible endpoint kinds. Multiplicity is editable only for class association/aggregation/composition families, using blank, `*`, a non-negative integer, or an ordered range such as `0..1`/`1..*`. Transition labels may describe a guard but the app does not evaluate it. Unsupported constructs in imported text/files produce a diagnostic and preserve the input; they are never silently dropped. Notes, UML package shapes, arbitrary styles and other values present only in internal types are not part of the advertised alpha subset.

## 3. Main scenario: review an order flow

Use synthetic examples with no company data. The main walkthrough is a small order service:

1. On the start screen, choose **Try an example → Order service**. Create a new unsaved project containing a class and a sequence diagram; leave the bundled example unchanged.
2. In the class diagram, inspect `Order`, `OrderItem` and `OrderService`. Add `cancel(reason: String): void` in text, then set a property and relationship multiplicity through the inspector. Both changes remain after switching views.
3. In the sequence diagram, add a message between `Client` and `OrderService`, edit its label, and reorder it. The text, visual order and exported order agree.
4. Save `order-review.uml.json`, close the app, reopen it, and verify members, relation ends, message order and layout.
5. Export SVG or PNG and share it for review. Share the project file when the reviewer needs editable content. Copying only DSL is a semantic excerpt and does not promise the full project's layout/history.
6. In a separate recovery exercise, edit a label, wait for the displayed recovery checkpoint, force termination, and restore the recovered copy. The previously saved file remains unchanged until explicitly saved.

Supplementary examples cover a use-case boundary with an external actor, an activity with a decision/fork/join, and a composite state with both a nested state and an external sibling. Each example links to a short task and expected result, not just a block of DSL.

## 4. Information architecture and screens

Proposed layout, retaining the existing tree/editor/canvas/inspector structure:

```text
New / Open / Save / Save As     Project name · file status     History / Export / Help
Type-specific tools            Select / connect / add
Project tree | Diagram tabs                                           | Inspector
             | Text editor               | Canvas                    | Properties
             | Inline diagnostics        | Last valid view if errors | Apply / Cancel
Diagram · selection · zoom     Errors / warnings       Recovery checkpoint status
```

| Screen/surface | Main information and actions | Empty, error and exit behavior |
| --- | --- | --- |
| Start / no project | New project, Open project, Try an example, short supported-scope explanation | Open failure leaves the current screen/project intact; no fake recent files |
| New project / diagram dialog | Required name; diagram type and destination folder where applicable | Trim boundary whitespace; blank names rejected; diagram creation canceled without modifying project |
| Workspace | Tree, tabs, text/canvas/split view, inspector; save and recovery shown separately | No selected diagram offers Create/Open diagram; switching view never rewrites content |
| Element / connector inspector | Only fields supported by the selected kind; temporary edit buffer; Apply/Cancel | Inline field errors; Apply disabled until valid; pending form edits resolved before changing selection |
| Problems panel | Severity, diagram, location and correction hint | Selecting a problem opens the relevant diagram/text; unresolved text keeps last valid canvas visible and labeled |
| Open / save / conflict dialogs | Current file, destination, meaningful error and retry/save-copy/reload choices | Cancel keeps current project and unsaved state; no destructive default |
| Recovery / history dialog | Project, checkpoint/snapshot time, type and description, restore/delete actions | Distinguish no history, corrupt history and unavailable storage; restore protects current work first |
| Export dialog | Format, PNG scale 1×/2×, content bounds, preview/summary and destination | Block export of an invalid active diagram with a link to its problems; no partial success toast |
| Help | Quick start, five examples, supported notation, shortcuts, file/recovery limitations | Available offline; support link does not attach project contents automatically |

Default mode is split view. Text-only and canvas-only modes retain selection, draft and viewport. On narrow desktop windows, the inspector becomes a toggleable panel and the tree can collapse; overlapping controls and an unusably narrow editor are not acceptable. Test layouts at 1280×800 and 1024×768. Mobile editing is outside scope.

## 5. Functional requirements and interaction rules

### P-01 — Start and learn

- New project requests a project name, then offers creation of a named diagram with class selected by default. Canceling the second step leaves a usable empty project.
- Examples open as independent unsaved projects. Replacing an existing dirty project uses the same protection as New/Open; examples never overwrite it silently.
- Help explains the local-only workflow, the supported subset, file portability and the difference between Save, recovery and image export. No sign-in is required.

### P-02 — Organize and navigate a project

- Create, rename, move and delete folders/diagrams through discoverable tree actions. Folder moves cannot create cycles. Reject duplicate sibling folder/diagram names with an inline error; a new copied item gets an editable non-conflicting name.
- A diagram appears once in the tree and may have one open tab. Switching diagrams preserves raw text, last valid model, selection/viewport and its undo history. Selecting the existing tab does not create a second session.
- Closing a tab only hides the diagram: its unsaved or invalid draft remains in the project and recovery data. Explain this distinction from deleting a diagram. Opening it again restores the draft.
- Deleting a folder/diagram lists the affected diagram count and creates a pre-delete snapshot before committing. Cancel/failure preserves the project. History exposes **Restore before deletion**; the user is told it restores the project snapshot, not an individual-item merge. If protection cannot be written, deletion is blocked with a storage action.
- New/Open/window close resolves pending property edits and, when the project is dirty, offers Save, Discard changes, Cancel. A canceled/failed save cancels the original action. A recovery checkpoint alone does not suppress the prompt.
- In browser evaluation mode, a download request cannot complete that save-before-leaving action automatically. Keep the project open until the user explicitly chooses to continue/discard after verifying their download. Browser tab closure may use the browser's native unsaved warning rather than the desktop dialog.

### P-03 — Edit on the canvas and undo

- Add only types valid for the active diagram. Selecting a connector tool, selecting a source, then a valid target creates one connection. Escape cancels; an invalid target explains why and creates nothing. Source/target names are visible during creation.
- Selection, multi-selection, move, supported resize, delete, fit-to-content, pan and zoom (25%–400%) are available. Move/resize is one undoable command per completed gesture. Moving a container moves its descendants; merely dragging a node across a border never changes ownership.
- Deleting elements also deletes incident connectors as one command. Deleting a container lists contained elements and removes the selected subtree after confirmation; undo restores the subtree and links.
- Copy/paste includes selected elements and links whose endpoints are both selected. A selected container includes its descendants. Paste allocates new IDs, assigns non-conflicting names and offsets layout. Cross-diagram paste is allowed only for the same type and must not create references into the source diagram. Cut removes the original only after the internal copy succeeds.
- Undo/redo is scoped to the active diagram and includes text changes (including invalid drafts) and accepted canvas/property edits in order. Group text typing into meaningful edits; preserve at least 50 recent groups in a live diagram session. New edits clear that diagram's redo branch. Ctrl/Cmd+Z in a form edits its temporary buffer; in the text editor/canvas it uses the diagram history. Undo history is not promised across app restarts. Tree deletion uses the separate snapshot action in `P-02`.

### P-04 — Commit properties and relationships safely

- Element and connector selections both open an inspector. Names, members/parameters, enum values, allowed visibility/stereotype, relation label, endpoints, applicable multiplicity, message order and parent selection are editable for the kinds in `D-01`–`D-05`.
- Fields use a temporary form buffer. Apply validates the whole edit and produces one undoable command; Cancel/Escape discards the buffer. Selecting another item or closing the project with a modified buffer offers Apply, Discard, Cancel. Save first attempts Apply and focuses the invalid field if it cannot commit.
- Names/labels support Unicode and Korean IME. A display name containing spaces or punctuation must be correctly quoted/escaped in DSL. Fields with a narrower grammar (for example member identifiers) explain the constraint and reject values the parser cannot round-trip. Do not silently sanitize user content.
- Rename preserves stable identity and updates all affected references. An ambiguous duplicate DSL-visible name within the same diagram is rejected in alpha. Changing an endpoint validates type and existence before committing. Whole/part and source/target ends have explicit labels; the user is not expected to infer them from IDs.
- Parent selection is available for use cases inside system boundaries and state nodes inside composite states. Reject invalid parent kinds, self-parenting and cycles. A nesting edit retains unrelated siblings and moves the child into a visible position within its parent; undo restores ownership and layout together.

### P-05 — Edit text without losing meaning

- Valid text updates the model/canvas after the editor debounce. Canvas/property edits update the affected DSL range while preserving unrelated comments/text and all supported properties. Layout and stable identity survive a semantic round trip; whitespace need not be globally reformatted.
- Pasting text follows normal editor selection replacement/insertion, not a hidden diagram merge. Undo restores the pre-paste draft. Duplicate names, missing endpoints or unsupported notation show diagnostics; never guess whether to overwrite, rename or skip an object.
- Invalid or ambiguous text stays visible and is included in save/recovery as a marked draft alongside the last valid model. The canvas shows **Last valid diagram — fix text errors to edit** and blocks model-changing actions; navigation and copying text remain available. If no valid model exists, show an empty canvas with the same explanation.
- Diagnostics distinguish syntax, semantic reference/type and unsupported-feature errors and provide location where available. Fixing text re-enables the canvas. If a canvas edit cannot preserve the draft safely, reject the edit with a reason and retain the original; never silently regenerate the whole source.

### P-06 — Open and exchange project files

- `.uml.json` is the portable editable project: diagrams/tree, stable identity, supported properties/ownership, layout and raw drafts/last valid state. Device recovery/history and transient selection are not a portable backup or a required part of the file.
- Validate the whole file before replacing the active project: schema version, unique IDs, tree/index consistency, endpoint existence, diagram/type compatibility, finite geometry and containment. Preserve the original file and active project on failure; identify the failing diagram/field where possible.
- Compatible old files migrate in memory without overwriting the source on Open. Unknown future versions are refused with a clear version message. Ambiguous historic nesting is not guessed. A valid stored DSL/model disagreement enters recovery review with choices to open either candidate as an unsaved copy; an explicitly marked invalid draft plus its last valid model is not treated as that conflict.
- Save As writes a new project identity, switches the active destination only on success and leaves the original unchanged. Diagram/element identities remain stable within the copied project. Local history starts separately for the new project; the original history is retained. Cancel/failure keeps the original identity and destination.
- Plain DSL may be copied/pasted as a single-diagram semantic excerpt. Exact DSL metadata/escaping/identity syntax and file migrations are specified in A02 before A04 implementation; no compatibility with unrelated diagram DSLs is claimed. Standalone DSL file round-trip fidelity is not an alpha promise.

### P-07 — Save and communicate status truthfully

| State/action | Visible behavior |
| --- | --- |
| New project or changed project | **Unsaved changes**; Save enabled; first Save opens destination dialog |
| Save in progress | **Saving…**; edits may continue; serialize saves so older writes cannot replace newer ones |
| Successful desktop write | **Saved** only if no newer edits exist; show destination and saved time |
| New edits during save | That saved revision is recorded, but **Unsaved changes** remains for later edits |
| Save canceled/failed | Dirty state stays; failure gives Retry / Save As where useful; original file remains intact |
| Externally modified file | **File changed outside UML Studio**; Cancel, Save Copy, Reload, explicit Overwrite |
| Browser download | **Download requested — verify the file**; never claim confirmed file save or clear unsaved state solely from requesting it |

External conflict Reload first protects the current project in recovery/history. Overwrite requires explicit selection and preservation of the externally changed file as a recoverable backup; inability to protect either side prevents overwrite. No conflict dialog automatically chooses a winner. Saving invalid DSL is allowed by `P-05`; show **Saved · text errors remain**, without implying that the diagram is valid. Image export never marks the project saved.

### P-08 — Recover and manage history

- The desktop app writes a durable recovery checkpoint within two seconds after a document edit, including raw text drafts and accepted canvas/property changes, and displays the last acknowledged recovery time independently of file status. Uncommitted inspector buffers are labeled **Not applied** and are not part of the checkpoint; P-04 protects them on normal navigation. Continuous typing must not postpone recovery indefinitely. If writing fails, show **Recovery unavailable** with a storage/retry action and keep manual save available.
- After an unclean exit, offer Recover as unsaved copy, Keep for later, or Delete recovery (explicit confirmation). Show project/destination and timestamp. Do not silently replace the saved file. Only edits after the latest acknowledged checkpoint may be absent from recovered content; do not promise arbitrary power-loss durability without measured evidence.
- History supports Create snapshot with optional description, list by time/type, restore and delete. Types distinguish manual snapshots and automatic pre-delete/pre-restore/pre-conflict protection. A restore validates the snapshot and creates a protective snapshot of the current project first, then loads the selected revision as unsaved. It does not auto-save over the file.
- Proposed retention defaults: keep the two latest successful recovery checkpoints per project; keep up to 20 automatic history snapshots per project; cap total device recovery/history storage at 500 MiB. Manual snapshots and latest recovery checkpoints are never silently evicted. Prune oldest eligible automatic snapshots before writes; if protected data still exceeds the cap, show a management dialog. Display storage use and deletion consequences. These defaults require confirmation against M0 fixtures and are not current implementation claims.
- Corrupt snapshot/index data is reported and quarantined for inspection/recovery; it must not appear as “no history.” A corrupt snapshot cannot replace a valid open project. Device history is labeled **On this device** and is not synchronized or included when sharing a project file.

### P-09 — Export a readable design

- Export the active valid diagram to SVG or PNG (1×/2×). Compute full content bounds with padding; do not export only the visible viewport. Include labels, relation ends, multiplicity, message order and nested nodes without clipping. Export uses a captured revision, so ongoing edits do not produce a mixed image.
- Show estimated dimensions before export and enforce the published raster limit. Keep colors/fonts consistent between canvas and image; use a documented fallback for unavailable fonts. Test long signatures, multiline labels and Korean text. SVG labels remain readable when opened outside the app.
- Empty diagrams and invalid active drafts produce a clear explanation and no misleading artifact. Other diagrams' errors do not block exporting a valid active diagram. Desktop success follows a confirmed write; browser status says download requested.

### P-10 — Operate with keyboard, language and helpful errors

- English default interface/help; Unicode project/element/file names; Korean IME composition never commits a half-composed edit or triggers a global shortcut.
- Discoverable keyboard commands: New project, Open, Save, Save As, undo/redo, copy/cut/paste/delete, fit, Escape and help. Use platform-appropriate modifier labels and scope shortcuts to the focused surface so typing in forms cannot delete canvas objects.
- Forms, tree, tabs, dialogs and help have accessible names, visible focus and keyboard navigation. Dialogs return focus to the launching control; errors use text, not color alone. Record a screen-reader walkthrough and any canvas accessibility limits; do not claim full conformance based only on this checklist.
- Errors identify what failed, whether current edits are retained, and one available action. Diagnostic reports exclude document content, paths and private labels by default; user review is required before copying richer diagnostic details.

### P-11 — Bound work and keep projects local

- Ordinary editing/open/save/export/help works offline after installation. No account, telemetry or project upload is required. Updates and external help links are separate explicit actions.
- Establish and publish file size, DSL size, nesting depth, element/connector and export pixel limits in M0. Check those limits before expensive parsing/rendering/allocation; too-large input leaves current work intact with a limit message. The exact numeric limits are a blocking M0 decision, not an undefined implementation default.
- Measure the [execution plan's quality targets](public-alpha-plan.md#m5-measurable-quality-gates): typical 20-diagram projects with 200 elements/300 connectors per diagram, p95 command feedback below 100 ms, text-to-canvas below 500 ms after debounce, open/save below 2 seconds, export below 5 seconds, and at least 30 fps for canvas manipulation on the recorded reference machine. Limits and actual results ship together; these are proposed budgets.

## 6. Acceptance scenarios

Run these on a specific release-candidate commit. “Pass” requires the recorded expected result; a document checkbox or unit-test count is insufficient. `AC-01` through `AC-15` are release scenarios to implement in the test plan, not tests that already exist.

| ID | Given / When | Then / required observation |
| --- | --- | --- |
| AC-01 First use | A fresh user starts without a project, opens the order example, edits both views, saves, restarts and exports | The user finishes the walkthrough unaided; the file and image reflect both edits; record elapsed time |
| AC-02 Property preservation (F1) | A class has a stereotype/visibility, members, comments and custom layout; change a property, then edit DSL whitespace, save/reopen | All supported properties, IDs, comments and layout remain; undo/redo is coherent |
| AC-03 Ownership (F2) | Composite `Active` contains `Inside`; `Outside` is its sibling; edit, reorder and round-trip | `Outside` stays outside; no cycles; explicit reparent and undo preserve intended ownership; repeat with a use-case boundary |
| AC-04 Validation (F3/F4) | Enter a member name invalid under its grammar, an invalid multiplicity, duplicate ID/name, missing endpoint or future file version | Field/text/file error is actionable; no accepted invalid model, overwritten draft or partially replaced project |
| AC-05 Draft continuity | Paste invalid DSL, switch tabs, close/reopen its tab, save/restart/reopen, then fix the text | Exact draft and last valid model survive each step; error state is honest; fixing text re-enables canvas |
| AC-06 Canvas transactions | Create a relation, change endpoints/order, paste a container subtree, delete it, undo/redo | One action has a coherent undo boundary; all endpoint/ownership IDs resolve; invalid target/self-link never creates a hidden connector |
| AC-07 Save outcomes (F5) | Cancel Save As, deny write, simulate full disk, edit during delayed save, or cancel/block a browser download | Original remains intact; correct revision/destination/identity and unsaved state; no false success |
| AC-08 External conflict | Change the same file outside the app before saving; exercise Cancel, Save Copy, Reload and Overwrite | No silent overwrite; each path preserves the promised original/current/external version and uses the selected destination |
| AC-09 Crash recovery | Edit valid and invalid drafts, observe the acknowledged checkpoint, force termination and recover | Recover at least the acknowledged revision as unsaved; original file unchanged; failed recovery writes are visible |
| AC-10 History protection | Delete a folder, restore a snapshot, hit quota, corrupt a snapshot/index | Pre-action protection exists or mutation is blocked; restore is unsaved; corruption differs from empty history; protected history is not silently evicted |
| AC-11 Notation and export | Complete create/edit/connect/copy/undo/save/reopen/export on each `D-*` fixture, including long and Korean labels | Text/model agree; all advertised notation/direction/labels are readable; full image bounds contain the content |
| AC-12 Input and accessibility | Complete forms/navigation with keyboard, Korean IME, a screen reader and both target window sizes | No accidental commands or lost composition; focus/errors are usable; canvas limitations are documented |
| AC-13 Capacity and failure containment | Open typical/stress/over-limit fixtures, repeat project open/close and history cycles, run offline | Published budgets/limits are measured; no supported-path crash, frozen destructive operation or sustained unexplained memory growth |
| AC-14 Portability and migration | Open a compatible old file, a conflicting text/model file, and a Save As copy on another installation | No source overwrite during open; conflicts are explicit; copy opens with drafts/layout intact and separate device history |
| AC-15 Delivery and security | Use clean source install and the proposed supported package; test privileged IPC/navigation/input failures | Actual CI/package evidence and dependency/security dispositions exist; no unmitigated reachable high/critical issue; required local-only actions work |

## 7. Traceability to execution

| Product contract | Acceptance | Milestone / planned slice |
| --- | --- | --- |
| P-01 onboarding; D-01–D-05 examples | AC-01, AC-11 | M0/M4/M6 · A01, A12, A14 |
| P-02 navigation / protective deletion | AC-05, AC-10 | M2/M4 · A08, A12 |
| P-03 canvas / undo; P-04 properties | AC-02–AC-04, AC-06 | M1/M4 · A03–A05, A12 |
| P-05 text fidelity / invalid drafts | AC-02–AC-05 | M1 · A02–A04 |
| P-06 portable files / migration | AC-04, AC-14 | M1/M2 · A02–A04, A06–A07 |
| P-07 save / conflict behavior | AC-07–AC-08 | M2/M3 · A06–A07 |
| P-08 recovery / history | AC-09–AC-10 | M2 · A08 |
| P-09 images; D-01–D-05 notation | AC-11 | M4 · A05, A11 |
| P-10 language / keyboard / errors | AC-12 | M4 · A12 |
| P-11 limits / local operation | AC-13, AC-15 | M0/M3/M5 · A01, A06, A09–A10, A13 |
| Release evidence and pilot | AC-01–AC-15 | M5/M6 · A13–A14 |

Implementation issues/PRs should cite the relevant `P-*`/`D-*` and `AC-*` IDs, list current gaps and attach verification. A requirement is complete only when its UI behavior, document transformations and applicable save/reopen/export path all pass. Architectural decisions belong in ADRs linked from A02; they cannot silently change a product behavior defined here.

For actual execution, use the [145 atomic tasks](atomic-execution-plan.md), which expand A01–A14 into leaf IDs, direct dependencies, affected surfaces and completion evidence. One work package is not one PR.

## 8. Relationship to the initial requirements

| Historical requirement | Proposed alpha disposition |
| --- | --- |
| 1 project management | P-01/P-02/P-07; recent files deferred |
| 2 diagram types; 3 element editing | D-01–D-05, P-03/P-04; only the declared subset |
| 4 undo/redo; 7 canvas navigation; 8 clipboard | P-03, including at least 50 live undo groups |
| 5 export | P-09: SVG/PNG; PDF deferred |
| 6 parsing/serialization | P-05/P-06; explicit draft/validation/migration rules; lazy loading and shared-element editing deferred |
| 9 tree; 10 tabs | P-02; closing a tab retains the project draft instead of treating it as deletion |
| 11 shared references; 12 lazy loading; 13 cross-diagram reference navigation | Deferred; ordinary tree/tab navigation remains |
| 14 DSL; 15 sync; 16 external generated text | P-05/P-06: safe text paste and diagnostics; no built-in AI or automatic duplicate-resolution merge |
| 17 canvas editing | P-03/P-04; alignment/distribution/custom waypoints deferred |
| 18 split view | Section 4: split/text/canvas modes and retained state |
| 19 version history | P-08: bounded device history and protected restore; rich version comparison deferred |

The current implementation still has the [F1–F7 findings](known-limitations.md). Neither the historical task checkboxes nor this draft resolves them.

## 9. Validation and launch decision

Use three independent pilot users and synthetic projects. Observe the first-use, interruption-recovery and sharing scenarios; capture where each person hesitates, fails or needs assistance. Fix blocking failures and repeat the affected scenario. Record pass/fail and timings manually; analytics infrastructure is not required.

Launch is blocked by a known destructive transformation, lost acknowledged recovery checkpoint, false confirmed save, supported-path crash, unexplained overwrite, or unmitigated reachable high/critical security issue. All advertised `D-*` workflows must pass. Cosmetic limitations can remain with clear release notes if they do not prevent a task.

The release candidate must link scenario results, native package runs, CI, visual/performance evidence and the [publication prerequisites](publication.md). Public alpha readiness does not establish enterprise support or full specification-driven development. Publishing the source and distributing a supported signed binary are distinct decisions.

## 10. Next product milestone: specification-driven development

This is a **discovery proposal after alpha**, not part of A01–A14. The initial vertical slice is an order cancellation API, chosen to connect requirements, API responses and allowed state transitions without adding a broad code generator.

Proposed user flow: create a requirement `REQ-CANCEL-01` → write acceptance examples → link an API operation and state transition → export the contract and runnable test artifacts → run against a sample service in CI → see a requirement ID and an expected/actual difference when behavior drifts. UML drawings alone must not be presented as executable contracts.

| Contract | Proposed artifact / decision |
| --- | --- |
| Requirement and acceptance examples | Stable requirement IDs; request/precondition/expected-response/expected-state examples |
| API and state contract | Candidate: OpenAPI plus an explicit transition contract; select supported versions and semantics in a separate RFC |
| Test execution | Select one reference backend/test runner in that RFC; generated artifacts remain reviewable and exportable |
| Traceability | Requirement → operation/transition → acceptance test → CI result; fail with the affected IDs, not only a diagram diff |
| Pilot exit | A correct sample service passes; a deliberately wrong response or forbidden transition fails; a contract edit predictably changes the test; another developer reproduces it from the exported artifacts |

Do not estimate or promise general implementation/specification synchronization until this slice is validated. This milestone needs its own PRD/RFC and acceptance fixtures rather than being added as an unchecked “AI/code generation” feature.

## 11. Decisions to close before implementation/release

The draft gives defaults to make work reviewable. The following decisions require evidence or maintainer resources; their open status must remain visible.

| Decision | Proposed direction | Needed by / accountable role |
| --- | --- | --- |
| Product scope baseline | Adopt P-01–P-11 and D-01–D-05; retain explicit deferrals | M0 / maintainer |
| File and DSL representation | Stable identity, explicit ownership, preserved raw drafts; exact syntax/migration in ADR | A02 before A03/A04 / implementer and reviewer |
| Limits and reference fixtures | Typical/stress sizes in P-11; choose byte/depth/pixel caps from measurements | A01 before import/IPC implementation / implementer |
| Recovery retention/storage | P-08 defaults; verify capacity and failure behavior | A08 / implementer and reviewer |
| Supported binary and trust | macOS Apple Silicon first, signed/notarized distribution | Scope in M0, evidence in M6 / maintainer |
| Private reporting and support | Verified non-public security/conduct contact; realistic support capacity | Before publication / maintainer |
| SDD format/runtime | One contract format and reference service/test runner | Separate post-alpha RFC / maintainer and pilot developer |

No open decision here authorizes publishing, implies an installed capability, or requires guessing private account details.
