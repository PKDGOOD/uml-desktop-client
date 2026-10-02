# UML Studio

**A local UML editor with a text DSL and an interactive canvas.**

Design class, sequence, use case, activity, and state diagrams in one Electron workspace. Edit text with Monaco, arrange shapes with Konva, and keep project files on your machine.

[한국어](docs/ko/README.md) · [Getting started](#getting-started) · [Contributing](CONTRIBUTING.md) · [Roadmap](docs/roadmap.md) · [Security](SECURITY.md)

> **Early alpha — not production-ready.** Known defects can lose properties or change nesting when switching between text and canvas. Keep backups and use disposable copies when evaluating. See [known limitations](docs/known-limitations.md). Open-source availability is not a production-readiness claim.

## What you can try

- Create projects, folders, and diagrams; navigate with tabs and search.
- Work in editor, canvas, or split view with per-diagram undo/redo.
- Copy and paste shapes within the app between diagrams of the same type.
- Save and open `.uml.json` projects, including unfinished text drafts.
- Create device-local snapshots and export diagrams as SVG or PNG.
- Run the editor without an account or a backend. Editor assets ship locally.

Automatic crash recovery, PDF export, collaboration, code generation, and contract testing are not available. This is a diagram editor, not yet a specification-driven development platform.

## Getting started

Prerequisites: **Node.js 24**, npm, and Git. `.nvmrc` selects the development Node major; the lockfile pins dependencies.

```bash
git clone https://github.com/PKDGOOD/uml-desktop-client.git
cd uml-desktop-client
# With nvm installed:
nvm use
npm ci
npm run dev
```

`dev` starts Vite and Electron together. Do not start a second Electron process. To run only the browser UI:

```bash
npm run dev:browser
```

Open the localhost address printed by Vite. The browser uses file upload/download; Electron uses native file dialogs. Browser downloads retain unsaved state because completion cannot be confirmed. Verify the downloaded file before closing the page.

### Your first diagram

1. Choose **+ Diagram**, enter a name, and select a diagram type.
2. Add a shape using the toolbar and canvas, or switch to **Editor** and paste [order-system.uml](examples/order-system.uml).
3. Use **Save** to keep a `.uml.json` project. **Open** accepts project JSON, not standalone `.uml` snippets.
4. Use **Export SVG** or **Export PNG** for an image. **History** keeps snapshots on this device only; they do not travel with the project file.

```text
@class-diagram "Order system"

class Order {
  - id: string
  + addItem(item: OrderItem): void
}

class OrderItem {
  - quantity: number
}

Order "1" --> "*" OrderItem : contains
```

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Electron + Vite development |
| `npm run dev:browser` | Browser development without launching Electron |
| `npm run check` | Type checking, repository checks, and unit/regression tests |
| `npm run test:watch` | Watch tests |
| `npm run test:readiness` | Synthetic fixtures and explicitly expected failures for open defects |
| `npm run qa:packaged` | Existing macOS package: save/restart/open and browser download regression |
| `npm run qa:baseline` | Headless reference data sizes and engine timings |
| `npm run build:app` | Type checking and renderer/main/preload bundles |
| `npm run notices` | Regenerate third-party license notices from installed locked packages |
| `npm run pack` | Build a local unpacked desktop app |
| `npm run build` | Build a distribution for the host platform |

Use `npm ci`, not an unreviewed dependency upgrade. Output goes to `dist/`, `dist-electron/`, and `release/`. `private: true` in package.json prevents accidental npm publication; it does not make the source repository private.

### Platform status

macOS Apple Silicon has a repeatable packaged save/restart/open smoke with automated picker answers; see [test scope and instructions](docs/testing.md). Windows and Linux are not validated desktop releases. CI is configured to check code and bundles across all three platforms; that does **not** validate native dialogs, installers, accessibility, or application recovery. macOS packaging uses ad-hoc signing, not Developer ID signing or notarization. No supported production binaries are advertised yet.

## Project and community

- [Documentation](docs/README.md): architecture, limitations, and release process
- [Contributing](CONTRIBUTING.md): setup, tests, and review expectations
- [Governance](GOVERNANCE.md) and [Code of Conduct](CODE_OF_CONDUCT.md)
- [Support](SUPPORT.md): bug reports and questions
- [Roadmap](docs/roadmap.md): prioritized work and acceptance criteria
- [Product specification](docs/product-spec.md) ([Korean](docs/ko/product-spec.md)): proposed users, workflows and behavior, linked to the [execution plan](docs/public-alpha-plan.md)
- [Atomic execution plan](docs/atomic-execution-plan.md) ([Korean](docs/ko/atomic-execution-plan.md)): task boundaries, dependencies and acceptance evidence
- [Execution status](docs/execution-status.md): actual completed work and verification evidence
- [Changelog](CHANGELOG.md): unreleased changes

Small fixes, documentation improvements, and reproducible bug reports are welcome. Discuss model/schema changes before implementing them; data preservation comes first.

## License

UML Studio is licensed under the [MIT License](LICENSE). Contributors retain copyright in their contributions. Dependencies have their own terms; see [Third-party notices](THIRD_PARTY_NOTICES.md). Desktop distributions must also retain Electron's bundled Chromium notices.
