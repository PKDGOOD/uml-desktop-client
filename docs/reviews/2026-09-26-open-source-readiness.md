# Open-source preparation review — 2026-09-26

Scope: prepare the repository for international source publication and maintenance. This does not resolve the [product-readiness defects](../known-limitations.md).

## Implemented locally

- English-first README and project documentation, Korean introduction, and a runnable synthetic DSL example.
- Existing MIT declaration completed with license text. Contributor rights and inbound-license expectations documented; no separate CLA or copyright assignment introduced.
- CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, GOVERNANCE, SUPPORT, CHANGELOG, CODEOWNERS, issue forms, and PR template.
- Pinned-action CI for Ubuntu/macOS/Windows, checksum-verified Gitleaks workflow, separate dependency-audit workflow, and Dependabot configuration.
- Node.js 24 development baseline and repository/link/example checks.
- Generated license texts for 25 installed locked dependency entries (including Electron), drift detection, and packaged project/dependency/Chromium notices.

## Local verification evidence

- Base commit: `1322f1c`; this preparation and prior product changes are still uncommitted. No remote workflow run or public release is claimed.
- A source-only copy was installed into a fresh temporary directory using official checksum-verified Node.js **24.21.0** and its npm **11.19.0**.
- `npm ci`: successful clean install (453 packages); existing dependency deprecation/install-script warnings remain.
- `npm run check`: type check, local documentation destinations, package/lockfile consistency, example parsing, and **19 files / 284 tests** passed.
- `npm run notices:check`: all 25 generated entries match a clean installed lockfile.
- `npm run pack`: successful macOS arm64 package, ad-hoc signed; not notarized.
- Packaged resources were byte-compared with the source project LICENSE, generated THIRD_PARTY_NOTICES.md, and installed Electron LICENSES.chromium.html: exact matches.
- actionlint **1.7.12**: workflow validation passed. Issue forms, Dependabot and release configuration parsed as YAML.
- Gitleaks **8.30.1**, redacted reports: all 4 commits in locally available Git refs scanned with no findings; a source-only snapshot of the pending working tree also had no findings. This is not proof of absence, a review of unseen remote refs, or consent to publish commit identities.
- `git diff --check`: passed.

## Still required before public launch

The GitHub repository was observed as private, with an empty description and no recognized license on the remote default branch. Private vulnerability-reporting status was unavailable (404); it is not marked enabled. No settings were changed.

Follow [the publication checklist](../publication.md): confirm source/asset rights and historical privacy, establish a verified private conduct contact and security reporting route, review/commit/push the intended changes, run CI on GitHub, configure branch protections, and explicitly decide on visibility. Existing product data-loss/security issues remain visible in the README and roadmap.

Do not confuse local macOS success with Windows/Linux desktop validation. Existing dependency findings, bundle-size/runtime-eval warnings, and Electron/Vite plugin warnings still require their own remediation. The dependency-audit workflow intentionally fails on unresolved high findings rather than reporting a clean bill of health.
