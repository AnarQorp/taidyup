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

## Onboarding V1 primitive contracts

Onboarding V1 adds two POST-only loopback endpoints:

- `/local-api/select-directory` accepts an empty JSON object and returns `SELECTED` with an existing absolute directory, neutral `CANCELLED`, recoverable `PICKER_UNAVAILABLE`, or `PICKER_FAILED`. Node opens a fixed native platform picker without a shell. The endpoint never accepts a command or path and never starts analysis.
- `/local-api/demo-analysis` accepts an empty JSON object and analyzes only the versioned `demo/onboarding-v1` artifacts through the real manifest, scanner, workflow, runtime, and reconciliation paths. Its `presentation.bundledDemo` marker is UI metadata outside Evidence and reconciliation.

Both endpoints retain the existing local-origin boundary. Folder selection falls back to manual entry when the host has no supported GUI picker. The bundled demo starts no provider and emits no CONNECTED evidence.

## Onboarding V1 UX Experience

The Onboarding V1 UX provides a first-use experience on top of the loopback primitive contracts:

- **Folder Picker Action (`Choose folder`)**: Invokes native `selectDirectory()` via `/local-api/select-directory`. On `SELECTED`, populates the path field without auto-analyzing. On `CANCELLED`, returns neutrally to form. On `PICKER_UNAVAILABLE` or `PICKER_FAILED`, renders non-blocking inline feedback while keeping manual path entry fully usable.
- **Bundled Demo Path (`Try demo project`)**: Invokes `analyzeBundledDemo()` via `/local-api/demo-analysis`. The UI renders presentation-only metadata (`Bundled onboarding demo`), preserving real reconciliation semantics (`SEND -> SUPPORTED`, `WRITE -> UNVERIFIED`, `EXECUTE -> UNDECLARED_OBSERVATION`, runtime `SEND -> UNDECLARED_OBSERVATION`, `CONNECTED -> absent`).
- **Guided Tour (`OnboardingTour`)**: 6-step step-by-step coachmark over real UI elements anchored by `data-tour-anchor`. Optional, keyboard-accessible (Esc closes, arrows navigate), with Step 1 replay support. Maintains strict copy guardrails (`SUPPORTED != AUTHORIZED`, `NO_RUNTIME_EVIDENCE != NOT_EXECUTED`) and mutates zero evidence state. Minimum 44px touch target ergonomics.

## Claim boundary

The UI visualizes declaration and static evidence, and can explicitly request one point-in-time n8n CONNECTED inspection through the local bridge. The browser sends only the environment-variable name; the bridge resolves the token in the local Node process and reuses `analyzeConnectedN8nWorkflow()` and its guarded transport. There is no automatic connection, polling, browser-to-n8n request, credential validation, or execution request.

Set the token in the environment that starts `npm run ui`, enter the local project and explicit CONNECTED fields, review the disclosed GET-only boundary, then start the inspection. A failed CONNECTED request does not replace an already displayed local result. The UI can also import an explicitly selected sanitized local RUNTIME JSONL artifact; it never starts monitoring or provider execution. Technical Passport, SARIF, report history, manifest editing, hosted accounts, regulation, and continuous monitoring remain outside the UI.
