# Baseline and packaged checks

Use Node.js 24 and the locked dependencies (`npm ci`). The [execution ledger](execution-status.md) records completed local tasks; the [dated baseline](reviews/2026-09-27-execution-baseline.md) records actual results and remaining gaps.

```bash
npm run check
npm run notices:check
npm run pack
npm run qa:packaged
```

`pack` includes `build:app`. `qa:packaged` currently requires macOS and defaults to `release/mac-arm64/UML Studio.app/Contents/MacOS/UML Studio`. An alternate local macOS package can be passed with `--app=/absolute/path/to/App.app/Contents/MacOS/App`. Build first: the harness tests the existing package, not an automatically rebuilt working tree.

The harness creates its own app processes, user-data directory, synthetic projects and SVG under ignored `.artifacts.local/`. It never connects to your running editing session. It uses the packaged renderer, preload and IPC with real file writes; the native picker answers are supplied automatically. It checks create/paste/save/restart/open/resave, compares persisted model/draft, and verifies blocked browser downloads keep unsaved state. It saves JSON reports, screenshots and process logs; the report includes the tested `app.asar` hash. Do not run it against an untrusted binary. It does not establish native-dialog usability, signed installer support or crash recovery.

The historical F5 reproduction is `npm run qa:packaged -- --expect-f5` against the pre-fix package. That mode must fail on a fixed package. Normal checks must use the default mode; never set the expected-bug flag to hide a regression.

## Focused fixtures and known failures

```bash
npm run test:readiness
npm run qa:baseline
```

`test:readiness` runs five positive fixture tests and seven named `it.fails` regressions for open F1–F4 defects. Vitest reports expected failures separately. They are included in the regular suite so an unexpected pass requires converting the relevant test to an ordinary regression. Do not add blanket skips/retries. Reproduction completion is not defect resolution.

`qa:baseline` measures the actual headless parser/serializer/SVG engine with synthetic 200/300 and 1,000/2,000 element/connector diagrams, plus a 20-diagram project. It records runtime/machine, byte counts, warm p95 and engine bundle hash in ignored `.artifacts.local/engine-baseline-*/metrics.json`. This is not a browser FPS, GUI response-time or native file benchmark.

## Evidence hygiene

Keep raw logs, profiles, builds and local backup archives ignored. Public evidence in `docs/reviews/evidence/` uses relative repository paths, synthetic labels and recorded hashes; review it for private paths before committing. Changing the binary or relevant source invalidates its old acceptance record. Re-run affected checks and attach the new build hash.
