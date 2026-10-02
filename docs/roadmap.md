# Roadmap

For users, product workflows, screen behavior and acceptance scenarios, see the [product specification](product-spec.md) ([한국어](ko/product-spec.md)). For milestone dependencies, estimates, work packages and measurable release gates, see the [public alpha execution plan](public-alpha-plan.md). Both are proposals for future work; unchecked items below remain open.

Execute one leaf at a time from the [atomic backlog](atomic-execution-plan.md) ([한국어](ko/atomic-execution-plan.md)): 145 tasks with direct dependencies and completion evidence. The [execution ledger](execution-status.md) records the completed local baseline and next steps. A01–A14 are work packages, not individual PRs.

The app is an early alpha. This is a prioritized work list, not a delivery schedule. The [readiness review](reviews/2026-09-26-commercial-readiness.md) contains original evidence; [known limitations](known-limitations.md) summarizes it in English.

## Open-source project foundation

- [x] One active parser and one grammar source
- [x] English-first documentation, Korean introduction, contribution/governance/support policies
- [x] MIT license text and generated third-party notices
- [x] Issue/PR templates and default maintainer ownership
- [x] CI and dependency update/audit configurations
- [ ] Verify CI on GitHub and configure repository rules/settings
- [ ] Verify private security and conduct reporting routes
- [ ] Complete the [publication checklist](publication.md)

Configuration files do not mean remote settings have been activated or workflows have passed.

## 1. Preserve model and specification meaning

- [ ] F1: preserve every supported property through DSL round trips
- [ ] F2: model explicit ownership for composite states/use case boundaries, with file migration
- [ ] F3: validate GUI commands and separate temporary form inputs from accepted changes
- [ ] F4: enforce unique IDs, endpoint existence, type compatibility, tree/index consistency, and supported versions

Acceptance: add the reproduced failures as failing tests first. All five diagram types must preserve supported semantics through model → DSL → model. Invalid input must produce actionable diagnostics rather than silent acceptance.

## 2. Save and recover safely

- [x] F5: distinguish browser download request from confirmed persistence; blocked-download packaged regression passes locally
- [ ] Restore drafts after crashes/forced termination
- [ ] Detect external file changes and prevent silent overwrite conflicts
- [ ] Define snapshot identity, quotas, retention, and corruption recovery

Acceptance: exercise save → close → restart → open and restore in the packaged app. Preserve originals on cancellation, permission failure, full disk, malformed files, and concurrent edits.

## 3. Security boundaries and dependencies

- [ ] F6: IPC sender, approved-document/path, and payload validation; CSP/navigation restrictions
- [ ] Evaluate build-time parser generation to remove runtime grammar compilation
- [ ] F7: classify and remediate runtime/build dependency vulnerabilities

Acceptance: review the actual shipped artifacts, demonstrate rejection of unapproved callers/paths, and document remaining audit impact without blanket waivers.

## 4. Release quality

- [ ] UI/IPC/packaged E2E and failure-injection tests
- [ ] Supported OS/architecture matrix and maximum document size
- [ ] Measured latency/memory budgets with representative documents
- [ ] Signing, notarization, release/upgrade/rollback procedures
- [ ] Verify license notices in every distributed artifact

## Later: specification-driven development

After specification preservation and persistence are reliable, connect requirements, acceptance criteria, API contracts, contract tests, and implementation/specification drift detection. Repository preparation is not completion of those capabilities.
