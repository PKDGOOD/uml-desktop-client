# Execution baseline — 2026-09-27

Scope: A01.01–A01.11, then the independently scoped F5 fix A07.03. This records local evidence for starting alpha implementation. It is not a production-readiness or publication approval.

## Preserved starting state (A01.01)

Starting branch: `main`; HEAD: `1322f1c5507ff3206c13c7aafdf3b77c07dba816`. The working tree already contained prior implementation and repository-preparation work. This batch did not reset, discard or claim authorship of those changes.

The [sanitized manifest](evidence/2026-09-27/source-manifest.json) contains 125 relative-path entries: 74 tracked and 51 untracked, including 7 deleted entries. Starting fingerprint: `1e052e540efd76c52b090213285e535a0ddebeadc1c7b06ae5280b89aec5cd8a`.

Ignored local backup: `.artifacts.local/baseline-20260926T204130Z/`. It contains `history.bundle` (all Git refs), binary tracked/staged/unstaged patches, `source.tar.gz`, status and the manifest. Recovery was actually tested: clone the bundle at the recorded HEAD, apply the manifest deletions, extract the source archive, compare every extant file's SHA-256/mode and verify deleted paths remain absent. All 125 entries matched. Build outputs, dependencies and unrelated ignored personal artifacts are not included in this source backup.

Proposed review/commit boundaries for A01.12:

| Existing group | Paths / purpose | Review handling |
| --- | --- | --- |
| Earlier product reliability work | `src/App.tsx`, session/sync/file/history/canvas components, `electron/` | Review as existing implementation, separate from today's F5 hunk |
| Canonical DSL cleanup | `src/parser/dsl/uml.pegjs`, parser/serializer; removed duplicate parser sources | Keep removals with their replacement and grammar tests |
| OSS preparation and product planning | Root community files, `.github/`, notices, Node metadata, `docs/` | Preserve authored plans; validate public text and configured checks separately |
| Current baseline tools | `alpha-*` examples, two new test files, two QA scripts, this evidence/ledger | Independently reviewable validation changes |
| Current F5 fix | Browser branch of `handleSaveProject` and ordinary packaged assertion | No file-format, native IPC or dependency upgrade |

The manifest also preserves a pre-existing deletion of the unusual root file named `"일시정지"`; this batch did not perform that deletion. No unrelated personal material was added to the evidence. Source commit assembly and independent review remain open.

## Exact local checks (A01.02)

Reference environment: Node **24.21.0**, npm **11.19.0**, macOS **27.0 (26A428)**, arm64, Apple M1 Pro (10 logical cores), 32 GiB RAM. The shell default was Node 25; checks explicitly selected the Node 24 runtime required by `.nvmrc`/package metadata. Existing locked dependencies were used; no upgrade was performed.

| Before this batch's source edits | Result |
| --- | --- |
| `npm run check` | Exit 0; 19 files, 284 tests passed; 3.21 s |
| `npm run notices:check` | Exit 0; 0.18 s |
| `npm run pack` | Exit 0; 18.65 s; includes notices, typecheck, Vite bundles and electron-builder directory package |

[Initial command results](evidence/2026-09-27/initial-checks.json) identify the raw logs retained under the local backup's `verification/` directory. After the F5 implementation, `check` reported **21 files, 289 passing tests + 7 expected failures**, and `pack` passed again. [Final results](evidence/2026-09-27/final-checks.json) and packaged reports identify that build separately.

Observed warnings remain: Vite output-option/alias warnings, a large bundle, Peggy direct `eval`, packager shell deprecation, default app icon and ad-hoc signing. They are not silently promoted to passing security/release acceptance. No remote CI, installer, Developer ID signing or notarization evidence was obtained here.

## Current versus target capabilities (A01.03)

Target: [P-01–P-11 and D-01–D-05](../product-spec.md). Initial binary target remains **macOS Apple Silicon**. This run covers only the machine/OS above, not a macOS version support range. Windows/Linux desktop support is unverified; browser mode is for evaluation. Proposed alpha excludes full UML, collaboration, accounts, PDF, code generation and specification-to-contract-test automation.

Legend: **W-E** = working in the named engine test only; **W-P** = working in the packaged harness; **F** = known failure/missing required behavior; **U** = not verified in this batch; **—** = not applicable. A W-E result never implies that the full GUI operation works. Each column's target is the corresponding D requirement, including all declared names, properties, notation and direction rules.

| Operation | D-01 Class | D-02 Sequence | D-03 Use case | D-04 Activity | D-05 State |
| --- | --- | --- | --- | --- | --- |
| Create supported palette model | W-E; project/diagram W-P | W-E | W-E | W-E | W-E |
| Select/manipulate each shape by pointer | U | U | U | U | U |
| Parse fixture text and preserve raw draft in a project | W-E + W-P | W-E | W-E | W-E | W-E |
| Preserve all required editable properties through text | F: F1/F3 | U | U | U | F: F2 |
| Create supported connector model/endpoints | W-E | W-E | W-E | W-E | W-E |
| Validate semantic endpoint compatibility | F: incomplete validation | F: incomplete validation | F: incomplete validation | U | U |
| Edit relation endpoints/labels in inspector | F: inspector absent | F: inspector absent | F: inspector absent | F: inspector absent | F: inspector absent |
| Edit multiplicity / message order / ownership | F: incomplete fields | F: explicit order absent | F: ownership absent | — | F: F2 |
| Copy/paste and undo paste | W-E | U | U | U | U |
| Save/open model + exact raw draft in engine | W-E | W-E | W-E; ownership not preserved by DSL serialization | W-E | W-E; F2 still applies |
| Native save → new process → open → resave | W-P | U | U | U | U |
| SVG content/string correctness | W-E; actual file W-P | W-E: message rows only | U | U | U |
| SVG visual parity / PNG fidelity | U | U | U | U | U |

Evidence: `projectWorkflow.test.ts` (palette round trips, class paste/undo and file workflow), `elementFactory.test.ts`, `exportEngine.test.ts`, [alpha fixture tests](../../src/engine/alphaFixtures.test.ts) and [packaged harness](../../scripts/smoke-packaged.mjs). “Incomplete” entries are established by the existing review and the inspector/model surfaces; they are not assertions that every combination was exercised.

Project-wide controls remain incomplete: Save As, Save/Discard/Cancel orchestration, crash recovery, external-file conflicts, history retention/quotas, privileged caller/path validation and restrictive runtime policy. Native picker interaction, keyboard/IME, accessibility, offline installation and all-five-type GUI acceptance remain unverified.

Release resources still undecided/unverified: supported macOS range, signing credentials/budget, private vulnerability-reporting channel, final support contact, pilot users, remote CI permissions/results, final publication scope. Initial local implementation can continue without presenting these resources as provisioned.

## Reproduction corpus (A01.04–A01.09)

[Fixture guide](../../examples/README.md) and [independent semantic oracle](../../examples/alpha-expectations.json) cover all five types, Korean labels, class signatures, ordered messages, use-case ownership, branching/fork/join activity and a composite state with an external sibling. The five tests assert type/name/endpoint order and exact raw-draft project persistence. Ownership is a desired expectation, explicitly not claimed to pass in the current flat model.

| Defect | Reproduction | Required corrected result | Fix leaf |
| --- | --- | --- | --- |
| F1 | Set `Order` stereotype `entity` and visibility `private`; apply whitespace text edit | Both values remain | A04.04 |
| F2 | Serialize `Active { Inside }` followed by external `Outside` | `Outside` remains top level | A04.07 |
| F3 | Apply attribute identifier `bad name` through a canvas command | Reject before committing invalid DSL | A03.07 |
| F4a | Duplicate an element ID | Reject project | A03.08 |
| F4b | Connector targets missing ID | Reject project | A03.08 |
| F4c | Tree entry missing its index record | Reject project | A03.08 |
| F4d | File declares version `999.0.0` | Reject unknown future version | A03.08 |
| F5 | Block browser anchor download after editing | Keep dirty state and say download requested | A07.03 (fixed in this batch) |

F1–F4 use `it.fails` in [readinessRegression.test.ts](../../src/engine/readinessRegression.test.ts); setup and positive controls run outside expected-failure callbacks. Unexpected success fails the test so the fix must deliberately remove `.fails`. There are seven known failed contracts, not seven supported outcomes. F5 uses the actual renderer save handler: [before](evidence/2026-09-27/packaged-before.json), [after](evidence/2026-09-27/packaged-after.json).

## Initial numerical budgets (A01.10)

These are selected **implementation input ceilings**, not measured support promises or currently enforced limits. A03/A06/A11 must enforce them before expensive work; A13.01–A13.03 must validate UI responsiveness, supported capacity and memory before advertising them. UTF-8 bytes and MiB (1,048,576 bytes) are used, not JavaScript string length.

| Input | Initial ceiling | Basis / qualification |
| --- | --- | --- |
| Project JSON | 16 MiB, 20 diagrams | Reference 20-diagram project is 3,879,676 bytes; leaves room for drafts/labels, while count and file ceilings both apply |
| Raw DSL | 1 MiB per diagram | 1,000-element stress DSL is 159,860 bytes; token count also bounded |
| Graph | 1,000 elements + 2,000 connectors per diagram; 4,000 elements + 6,000 connectors per project | Stress diagram and typical project measured independently; limits are conjunctive, not 20 stress diagrams |
| Nesting | 8 composite levels and 8 folder levels, top-level depth 0 | Conservative recursion budget selected from shallow acceptance cases; depth 8 performance is not yet measured; reject cycles independently |
| Geometry | Finite x/y and waypoints within ±1,000,000; width/height in (0, 100,000]; zoom 0.25–4 | Safety budget, not a precision/performance claim; bounds must be checked after scaling too |
| PNG allocation | At most 16,000,000 pixels and 8,192 pixels on either side, including padding and export scale | One RGBA buffer alone needs up to 64 MB; real renderer needs more. Not validated as a safe total-memory budget yet |

Measurements from `npm run qa:baseline`: actual parser/serializer/SVG engine bundled from the working tree; 3 warmups, 20 samples, nearest-rank p95. [Machine, sizes and full metrics](evidence/2026-09-27/engine-metrics.json) include bundle SHA-256.

| Dataset | DSL parse p95 | DSL serialize p95 | SVG string p95 |
| --- | --- | --- | --- |
| 200 elements / 300 connectors | 3.07 ms | 0.22 ms | 1.42 ms |
| 1,000 elements / 2,000 connectors | 15.69 ms | 0.78 ms | 16.72 ms |

20-diagram JSON parse p95: **7.68 ms**; serialize p95: **5.12 ms**. These are headless warm measurements, not input-to-canvas, FPS, file I/O, PNG, cold startup or durability measurements. No UI performance target is closed by these numbers.

## Packaged path and F5 correction (A01.11 / A07.03)

The harness starts an isolated ad-hoc signed `.app`, creates a new project/diagram through UI controls, pastes the class fixture into Monaco, saves through the real preload/IPC/file writer, reads the saved JSON, terminates that process, launches another process, opens and resaves, compares model and raw draft, and writes/reads SVG. The Korean project/file names, 5 elements, 4 connectors and exact draft survive. It then opens a separate renderer without preload and blocks its download anchor to check browser semantics.

Only native picker answers and test confirmation responses are stubbed; no production test hook or synthetic model setter was added. Monaco paste data is synthetic and does not replace the user's OS clipboard. Test profiles/files/logs/screenshots stay under ignored `.artifacts.local/packaged-smoke-*`. The inspector binds to loopback in these owned test processes, which are closed at the end.

Before the fix, the blocked request cleared dirty state. Now the browser branch requests a download, reports **“Download requested (.uml.json). Verify the file; changes remain unsaved.”**, and returns without calling `markSaved`. Native save continues to acknowledge the captured revision only after its write resolves. No format migration or new IPC channel is involved; this is why A07.03's former A02.08 prerequisite was removed.

This smoke proves the exercised filesystem flow, not power-loss durability, cancellation/permissions/full-disk handling, real picker usability, SVG visual parity, all five GUI workflows or recovery. Those remain their own acceptance tasks.
