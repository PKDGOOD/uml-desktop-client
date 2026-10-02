# Changelog

Changes are documented here before a tagged release. The package version `0.1.0` is not evidence of a published or supported binary release.

## Unreleased

### Added

- Blank projects and creation tools for five diagram types.
- Per-diagram editing sessions, local snapshot UI, clipboard actions, and SVG/PNG export.
- Project-file validation and workflow regression tests.
- Open-source contribution, security, governance, issue/PR, and release guidance.
- CI configuration, dependency update configuration, and reproducible third-party notices.
- Synthetic five-type fixtures, explicit known-failure regressions, reference engine measurements and a macOS packaged save/restart/open smoke harness.

### Changed

- Preserve raw DSL drafts when switching diagrams and saving projects.
- Replace desktop files through a temporary-file rename.
- Use one DSL grammar source and separate browser and Electron development commands.
- Keep browser projects unsaved after a download request; show an explicit file-verification notice instead of confirming persistence (F5).

### Known issues

Model/DSL information loss, containment changes, invalid property inputs, reference validation and security hardening remain open. See [known limitations](docs/known-limitations.md). These are not claimed fixed by repository preparation.
