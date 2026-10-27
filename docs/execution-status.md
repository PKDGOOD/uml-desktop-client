# Public alpha execution status

Updated: **2026-10-27**. This is the live ledger for the [145-task backlog](atomic-execution-plan.md). “Done” below means locally implemented and verified, with a self-review; it does not mean merged, independently reviewed, remotely tested or released. Implementer: Codex. Maintainer review remains pending in A01.12.

[Korean atomic execution plan](ko/atomic-execution-plan.md) · [Baseline evidence](reviews/2026-09-27-execution-baseline.md) · [Repeat the checks](testing.md)

## Current batch

| Task | State | Outcome and evidence |
| --- | --- | --- |
| A01.01 | Done | 125-entry source manifest; local Git bundle, patches and archive; restored checkout matched all file hashes/modes and deletions. See baseline report's preservation section. |
| A01.02 | Done | Node 24.21.0: original 284 tests, notices and macOS package passed; initial fingerprint and exact command results retained. |
| A01.03 | Done | Five-type capability matrix separates engine evidence, packaged evidence, failures and unverified operations; alpha support assumptions and pending release resources listed. |
| A01.04 | Done | Five synthetic DSL fixtures plus independent names/types/endpoints/order/ownership expectations; five parser/project round-trip tests. |
| A01.05 | Done | F1 property loss reproduced as an explicit expected failure; the regression now passes after class DSL gained element visibility and stereotype syntax. In-place patching for A04.04 remains open. |
| A01.06 | Done | F2 external-state containment regression reproduced as an explicit expected failure. Fix remains A04.07. |
| A01.07 | Done | F3 invalid member command reproduced as an explicit expected failure. Fix remains A03.07. |
| A01.08 | Done | Four independent F4 invalid-project acceptances reproduced as expected failures. Fix remains A03.08. |
| A01.09 | Done | Packaged renderer without preload + blocked download reproduces F5; before/after reports retained. |
| A01.10 | Done | Reference machine, measured engine/data sizes and initial numerical input budgets recorded. Enforcement and full UI capacity validation remain later tasks. |
| A01.11 | Done | macOS packaged create/paste/save/new-process/open/resave/SVG harness verifies actual disk content. Native picker answers are stubbed. |
| A07.03 | Done | Browser download requests retain unsaved revision and show an explicit verification notice; ordinary packaged regression checks the blocked-download case. |
| A01.12 | Ready | Review and split the preserved mixed working tree into baseline commits; no commit/push was made by this batch. |
| A02.01 | Done | [ADR 0001](decisions/0001-project-file-envelope.md) proposes the schema-2 envelope: integer `schemaVersion` separate from informational writer version, `project.id`, `textStatus` invalid-draft marker, derived diagram index, ID/reference rules and an ordered reject/migrate table with valid, legacy, future and malformed examples. Accepted by the maintainer, including unknown-key rejection and the first-save legacy ID. |
| A02.02 | Review | [ADR 0002](decisions/0002-dsl-identity-and-source-edits.md) proposes name-keyed element identity, inspector-only identity-preserving rename, quoting/escaping, source spans, two-pass connector matching and diagnostics for ambiguous input. Awaiting maintainer acceptance. |
| A02.03 | Done | `DiagramElement.parentId` (absent = top level) and sequence `Connector.messageOrder` (1..n) in `src/types/index.ts`. Detached fixtures in `src/types/structureFixtures.ts` deliberately mislead array-order readers (F2 shape, a use case after a boundary, shuffled messages); tests match the A01.04 ownership/label oracle and survive a project file round trip. Parser, serializer, canvas and validation do not read the fields yet (A04.07, A04.08, A03.05). |
| A01.13 | Planned | Needs A01.12 and actual remote CI evidence. |

Every task not named above remains **Planned**. **13 of 145 local tasks are Done**, including reproduction tasks, not 12 shipped features. G0 (local baseline) is satisfied; M0 is still incomplete until baseline commits and remote CI are verified. G1–G4 remain unmet. Current validation: **22 test files, 297 passing tests and 7 explicitly expected failures**; `npm run check` and `npm run build:app` passed after A02.03. Notices, package and the packaged smoke were last run at the A01 baseline.

## Dependency correction

A07.03 now depends on A01.09 only. Its former A02.08 dependency was unnecessary: the change stops acknowledging a browser download as a disk write and does not change project schema, migration, serialization or native IPC. Both language versions of the backlog record this correction. A07.04 still owns the broader Save/Discard/Cancel navigation flow.

## Next sequence

1. Maintainer review of ADR 0002 (A02.02).
2. A02.04 (schema-2 codec), unblocked by ADR 0001 and A02.03; then A02.05–A02.08 in dependency order.
3. A03/A04: convert the seven expected failures to ordinary passing regressions as their linked fixes land.
4. A01.12–A01.13 can proceed independently with maintainer review and private CI; they do not require publishing the repository.

F1–F4, F6–F7, recovery, conflicts and release validation remain open. The application is still an early alpha, and specification-driven development through generated contract tests is a separate product milestone.
