# Public launch checklist

This is an operational checklist, not proof that the desktop app is production-ready. Source may be released as an explicitly experimental alpha; production binary approval has separate [release gates](releases.md).

## Repository preparation

- [x] English entry point and Korean introduction
- [x] License text, dependency notices and packaging configuration
- [x] Contribution, governance, support, security, and conduct policies
- [x] Bug/feature/question forms, PR template, CODEOWNERS
- [x] CI and Dependabot configurations with minimal workflow permissions
- [x] Known limitations and prioritized acceptance criteria
- [ ] Confirm copyright/asset provenance and distribution rights
- [ ] Scan the final working tree and all Git refs immediately before publication; investigate every finding (a clean scanner is not proof of absence)
- [ ] Review commit author emails and historical content for personal/company information; do not rewrite history without deciding how collaborators will migrate
- [ ] Verify private security and conduct reporting channels
- [ ] Review, commit, and push the intended changes; keep unrelated local work separate

## GitHub settings (maintainer action)

The repository was observed as **private** on 2026-09-26. Local files do not change its visibility or settings.

1. Review the exact source/history to expose, then explicitly change visibility to public when ready. A private repository URL in documentation does not make it accessible.
2. Set an English description: `Local UML editor with a text DSL and interactive canvas. Early alpha.` Suggested topics: `uml`, `diagram-editor`, `electron`, `typescript`, `monaco-editor`, `konva`.
3. Enable private vulnerability reporting under Security; submit a benign test to verify the reporting route, then handle it privately. Add a verified private conduct-reporting contact to CODE_OF_CONDUCT.md.
4. Run the CI workflow on the pushed commit. Only after the real check names exist, require `Validate (ubuntu-latest)`, `Validate (macos-latest)`, and `Validate (windows-latest)` in the default-branch ruleset.
5. Require pull requests, resolved review conversations, and passing checks; block force-pushes/deletion. Require independent/CODEOWNER review when another reviewer is available, rather than configuring an impossible self-approval rule for a solo maintainer.
6. Keep workflow tokens read-only by default and approval required for first-time outside-contributor workflow runs. Never use `pull_request_target` to execute untrusted PR code with secrets.
7. Verify Dependabot alerts/updates and secret scanning/push protection where available. Do not assume these are enabled because configuration files exist.
8. Review the dependency-audit failure separately; current known findings are not waived by ordinary CI passing.

## Evidence to record

See [local preparation evidence](reviews/2026-09-26-open-source-readiness.md). Record the exact commit, CI run links, secret-scan scope/result, private-reporting verification, checked platform matrix, and any accepted limitations in the launch PR. Do not publish scanner reports containing suspected secrets. Do not advertise supported production binaries until the release gates are met.
