# Security policy

## Supported versions

The project is an early alpha. There is no supported production release or security maintenance branch. Fixes target the current development branch until a release/support policy is announced. Do not use the app to open untrusted project files or as the sole store of sensitive design data.

## Reporting a vulnerability

Do not post exploit details, credentials, sensitive files, or proof-of-concept payloads in public issues.

Use GitHub's [private vulnerability reporting](https://github.com/PKDGOOD/uml-desktop-client/security/advisories/new) when it is enabled. If that form is unavailable, open an issue titled **Request a private security contact**, without technical details, and wait for a maintainer to provide a private channel. The project does not publish an unverified email address.

Include affected commit/version, operating system, reproduction using synthetic data, impact, and any mitigation. Keep investigation limited to systems and data you own or have permission to test. Coordinate disclosure with the maintainer; no response-time or bounty commitment is currently offered.

## Maintainer handling

Acknowledge privately, reproduce safely, determine affected versions and impact, prepare a fix with regression tests, and agree on disclosure timing. Release security fixes with a clear advisory and upgrade guidance. Do not copy a private report into a public issue before coordinated disclosure.

## Current hardening work

IPC validation, navigation/CSP policy, dependency updates, file validation, and recovery are tracked in the [roadmap](docs/roadmap.md). Known audit findings are not silently waived. The separate dependency-audit workflow can fail while those findings remain; ordinary CI passing is not a clean security audit.
