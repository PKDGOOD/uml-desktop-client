# Known limitations

This page separates open-source project infrastructure from product readiness. The repository can accept contributions while the application remains an early alpha. Do not use it as the only copy of an important specification.

The following issues were identified in the [2026-09-26 review](reviews/2026-09-26-commercial-readiness.md). Current status is updated from the [2026-09-27 execution evidence](reviews/2026-09-27-execution-baseline.md):

| ID | Problem | Consequence |
| --- | --- | --- |
| F1 | Stereotype/element visibility are not preserved by DSL round trips | Editing text can discard properties set in the UI |
| F2 | Nested ownership is inferred from flat element order | A top-level state can move inside a composite state |
| F3 | Property editing can generate invalid DSL without reporting errors | A project may appear valid until it is reopened |
| F4 | Duplicate IDs, unresolved endpoints, tree/index consistency, and future versions are not fully validated | Invalid projects may be accepted and connectors hidden |
| F5 — fixed locally | Browser downloads now report a request and retain unsaved state | A blocked-download regression passes; the user still needs to verify the downloaded file |
| F6 | IPC, approved paths, CSP, and navigation need hardening | Renderer compromise is not sufficiently contained |
| F7 | Dependency audit has unresolved findings | Runtime and build-chain exposure need individual triage and updates |

F1–F4 have seven explicit expected-failure engine tests and remain open. F5 was reproduced and corrected through the actual renderer save handler. F6 remains based on code inspection, not an exploit test. Audit totals change over time; run the audit workflow instead of treating the historical count as current.

Additional gaps include automatic crash recovery, file conflict detection, snapshot retention/quotas, enforced input limits, measured GUI capacity, and externally trusted signing/notarization. A macOS class-diagram packaged save/restart/reopen smoke now passes with picker answers stubbed; native-dialog usability and the full five-type acceptance flow remain unverified. A passing CI build is not evidence that these risks are resolved.

PDF export, collaboration, shared-element UI, version-diff UI, code generation, and contract tests are not available. See the [roadmap](roadmap.md) for acceptance criteria and priority.
