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

The UI visualizes declaration and static evidence, and can explicitly request one point-in-time n8n CONNECTED inspection through the local bridge. The browser sends only the environment-variable name; the bridge resolves the token in the local Node process and reuses `analyzeConnectedN8nWorkflow()` and its guarded transport. There is no automatic connection, polling, browser-to-n8n request, credential validation, or execution request.

Set the token in the environment that starts `npm run ui`, enter the local project and explicit CONNECTED fields, review the disclosed GET-only boundary, then start the inspection. A failed CONNECTED request does not replace an already displayed local result. The UI can also import an explicitly selected sanitized local RUNTIME JSONL artifact; it never starts monitoring or provider execution. Technical Passport, SARIF, report history, manifest editing, hosted accounts, regulation, and continuous monitoring remain outside the UI.
