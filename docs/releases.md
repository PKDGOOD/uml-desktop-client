# Release process

Only the maintainer publishes a release. No workflow currently publishes packages or binaries automatically. `0.1.0` in package.json is a development version, not a support promise.

## Before tagging

1. Choose the scope and label early builds explicitly as prereleases. Review [known limitations](known-limitations.md); do not hide unresolved data-loss/security risks behind a stable version.
2. Update package.json and lockfile versions together; move relevant CHANGELOG entries under a dated release heading.
3. On a clean checkout with Node.js 24, run `npm ci`, `npm run check`, `npm run notices:check`, and `npm run build:app`.
4. Check CI on every claimed platform. Triage dependency audit results including Electron even though it is a devDependency.
5. On each supported platform, package and verify save/open after restart, snapshot restore, exports, cancellation, and failure recovery. Record OS/architecture and results. Bundle-only CI does not count.
6. Confirm source/asset rights and dependency terms. `npm run notices` regenerates THIRD_PARTY_NOTICES.md. Packaging includes the project license, these notices, and the installed Electron Chromium notices in app resources. Inspect the actual artifact rather than assuming configuration is sufficient.
7. Apply the appropriate signing/notarization for public binaries. Do not ask users to bypass operating-system security warnings as the normal install flow.

## Publish

Create a reviewed tag matching the package version and a GitHub release with change notes, known limitations, support status, exact platform/architecture, install/update instructions, and SHA-256 checksums for each binary. Label unsigned/internal test builds clearly and do not present them as production installers. Source and desktop releases are separate from npm publication; package.json remains private to prevent accidental npm publishing.

## After publishing

Verify each published download and install path. Keep previous artifacts available. If a release is unsafe, mark it clearly, stop recommending it, document affected versions and recovery/rollback guidance, and ship a fix. Do not silently replace an existing release asset with different bytes or retag released commits.
