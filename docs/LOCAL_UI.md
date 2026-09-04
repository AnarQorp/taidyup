# tAIdyup Local UI — Phase 1

The Phase 1 UI is a visual client of the same application use case used by the CLI:

```text
local project
  -> analyzeLocalProject
     -> ManifestParser
     -> ScannerCore
     -> ScannerAdapter
     -> ReconciliationEngine
  -> ReconciledTrustState
     -> CLI
     -> Local UI
```

The UI does not parse CLI text and does not reconstruct reconciliation semantics.

## Run locally

```bash
npm run build
npm run ui
```

Open `http://127.0.0.1:3001` and enter the absolute path of an existing local project directory.

## Local bridge security boundary

- Binds only to `127.0.0.1`.
- Accepts only same-machine browser origins.
- Accepts a small JSON request containing one local path.
- Reuses the Core target validation: remote URLs and Git references are rejected; missing paths and files are explicit errors.
- Does not clone or fetch repositories.
- Does not call repository, model, cloud, or provider APIs.
- Does not upload source code or emit telemetry.
- Uses no database, organization, user, connector, or hosted-history model.
- Returns the typed `LocalProjectAnalysis` result containing the Core's original claims, evidence, provenance, findings, and `ReconciledTrustState`.

Because portable browsers do not reveal an absolute filesystem path from a directory picker, Phase 1 uses an explicit local path field. Filesystem access occurs only in the loopback Node process started by the developer.

## Claim boundary

The UI visualizes static and declaration evidence only. `CONNECTED` and `RUNTIME` are shown solely as unavailable future layers. A supported claim is not a statement about execution, authorization, safety, or compliance. Unknown is not failure, and unverified is not false.

Technical Passport, SARIF, visual diff/history, manifest editing, hosted accounts, regulation, connected evidence, and runtime evidence are intentionally outside Phase 1.
