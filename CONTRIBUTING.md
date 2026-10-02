# Contributing to UML Studio

Thank you for helping improve the editor. Read the [Code of Conduct](CODE_OF_CONDUCT.md) and [known limitations](docs/known-limitations.md) before getting started. English is the shared language for project documentation and review; Korean reports are also welcome. Clear reproductions matter more than polished language.

## Choose a contribution

Check [open issues](https://github.com/PKDGOOD/uml-desktop-client/issues) and the [roadmap](docs/roadmap.md). Small bug fixes, accessibility improvements, examples, and documentation are welcome. Discuss new features, file-format changes, dependency replacements, or broad refactors in an issue first. Do not post security exploit details publicly; use [SECURITY.md](SECURITY.md).

## Set up

Fork the repository, clone your fork, and create a descriptive topic branch. No special branch prefix is required for human contributors.

```bash
nvm use # optional, if you use nvm; otherwise install Node.js 24
npm ci
npm run dev:browser
# Or launch the desktop app:
npm run dev
```

Keep the lockfile. Do not commit build output, personal projects, credentials, or local diagnostic dumps. Use minimal synthetic fixtures rather than company documents.

## Design constraints

- Read [architecture](docs/architecture.md). `ProjectSession` owns drafts and diagram histories; UI state is not a replacement for the domain model.
- `src/parser/dsl/uml.pegjs` is the only grammar source. Do not add a generated grammar-string copy.
- Model changes must preserve information through GUI → DSL → model and save → open. Add a failing reproduction before fixing a regression.
- File-format changes need explicit version handling, migrations, and original-file preservation on failure.
- Treat IPC and imported project files as trust boundaries. TypeScript types do not validate untrusted input.
- Modules not connected to the application must not be advertised as complete features.
- Keep refactors, dependency upgrades, and behavior changes in reviewable units. Preserve unrelated local changes.

## Validate

```bash
npm run check
npm run build:app
```

Tests live next to the implementation in `src/**/*.test.ts`. Current tests run in Node; they do not replace UI or packaged Electron checks. If you touch IPC, native file dialogs, or packaging, test the actual desktop flow and state the OS/architecture used. If you cannot run a check, say so in the PR.

The [test guide](docs/testing.md) explains `npm run qa:packaged`, reference measurements and the explicit expected-failure regressions for open defects. Run the ordinary packaged check after `npm run pack` for save/download changes. Expected failures are not passing product contracts.

When dependencies change, run `npm run notices`, review the result, and include it in the PR. `npm run notices:check` detects drift. Review audit findings by affected runtime and reachable behavior; do not run `npm audit fix --force` blindly.

## Submit a pull request

Use the PR template. Explain the user-visible problem, resulting behavior, relevant issue, and test evidence. Include screenshots for visible UI changes and a migration/compatibility note when needed. Keep titles descriptive. Automated checks and maintainer review are required before merging; passing unit tests alone is not a release approval.

Use synthetic data in any AI-assisted changes and review generated code yourself. You are responsible for correctness, provenance, dependency licenses, and test claims regardless of the tools used.

By submitting a contribution, you agree to license it under the repository's MIT License. Only contribute material you have the right to share. No copyright assignment or separate CLA is currently required.
