# Changelog

Changes are documented here before a tagged release. The package version `0.1.0` is not evidence of a published or supported binary release.

## Unreleased

### Added

- Blank projects and creation tools for five diagram types.
- Per-diagram editing sessions, local snapshot UI, clipboard actions, and SVG/PNG export.
- Project-file validation and workflow regression tests.
- Open-source contribution, security, governance, issue/PR, and release guidance.
- CI configuration, dependency update configuration, and reproducible third-party notices.
- `parseDSLWithSpans` reports where each element, member and connector sits in the DSL text (UTF-16 offsets), the groundwork for edits that change only the affected text.
- Renaming an element in the inspector edits only its name in the text (declaration and connector ends), so comments and spacing around it stay.
- Synthetic five-type fixtures, explicit known-failure regressions, reference engine measurements and a macOS packaged save/restart/open smoke harness.

### Changed

- Preserve raw DSL drafts when switching diagrams and saving projects.
- Replace desktop files through a temporary-file rename.
- Use one DSL grammar source and separate browser and Electron development commands.
- Keep browser projects unsaved after a download request; show an explicit file-verification notice instead of confirming persistence (F5).
- Save projects in the schema-2 file format (ADR 0001): a durable project ID and, per diagram, the DSL text, last valid model and whether the text parses. Older files open as unsaved and are upgraded on save; old files whose nesting cannot be recovered are refused with an explanation.
- Check names, members, multiplicity, labels and connector ends against the five diagram kinds when opening a file, after each text edit and before each canvas change. A draft that breaks a rule stays as typed and is reported on its line; the diagram keeps its last valid model.
- When a file's stored text and diagram disagree, Open asks which to keep for each diagram instead of picking one; the project opens unsaved.

### Known issues

Model/DSL information loss, containment changes, invalid property inputs, reference validation and security hardening remain open. See [known limitations](docs/known-limitations.md). These are not claimed fixed by repository preparation.
