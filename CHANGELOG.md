# Changelog

All notable changes to tAIdyup will be documented in this file.

## [0.1.0-alpha.3] - Release candidate (unpublished)

### Product and evidence model
- Added explicit local RUNTIME V0 evidence import while keeping runtime observation orthogonal to authority.
- Stabilized the four evidence dimensions: DECLARED, OBSERVED, CONNECTED, and RUNTIME.
- Added the repository-only Woodcraft Workbench, Onboarding V1, native folder-picker bridge, bundled synthetic demo, guided tour, and dynamic demo CTA.
- Added Manifestless V1.1: ordinary local projects can be inspected without a declaration, with explicit `declarationContext` `PRESENT` / `ABSENT` semantics.

### Release hardening
- Prepared deterministic CLI-only npm packaging, synchronized package/CLI/SARIF versions, repaired global help/version flags, package metadata, CI, and fresh-install artifact checks.
- Reconciled public terminology, Quick Start, JSON declaration support, YAML limitation, local-first boundaries, and npm-versus-repository UI distribution.
- Updated bounded development dependencies and transitive overrides after an explicit security audit.

### Development validation only
- Added an OpenTelemetry composition lab for deterministic mapping tests. It is not supported telemetry ingestion, monitoring, instrumentation, or a runtime collector.

## [0.1.0-alpha.2] - 2026-09-05

### Added
- Structural agent/capability binding and dimensional Trust Kernel reconciliation.
- Conservative local n8n workflow evidence and explicit opt-in n8n CONNECTED V0 point-in-time inspection.
- Local Trust Kernel UI slice, connected-evidence display, guarded transport, current-state drift semantics, and reproducible synthetic drift demo.
- Scanner evidence provenance/hygiene, CLI local-target validation, owner-reviewed declaration acceptance, SARIF/report/diff refinements, and adversarial/integration coverage.

### Boundaries
- CONNECTED retrieval was explicit, GET-only, provider-targeted, and did not establish execution, credential validity, authorization, or compliance.
- The published npm artifact was CLI-only.

## [0.1.0-alpha.1] - 2026-08-15

### Initial Release Candidate (Developer Alpha)
- **Local-First CLI (`taidyup`):** Zero account, zero SaaS Cloud, zero source code upload required.
- **Trust Kernel Engine (`src/trust-kernel/`):** 100% deterministic claim & evidence reconciliation engine.
- **Epistemic Claims & Evidence:** Formal state machine (`SUPPORTED`, `UNVERIFIED`, `CONFLICT`, `UNDECLARED`, `UNKNOWN`).
- **Declaration Manifest V0:** JSON declaration input through `taidyup.json`.
- **Technical Passport Generator:** Produces deliverable `TECHNICAL_PASSPORT.md` for clients and auditors.
- **OASIS SARIF v2.1.0 Export:** Native integration with GitHub Code Scanning & GitLab CI (`taidyup.sarif`).
- **Semantic Authority Diff:** Compares release artifacts for critical authority expansions.
- **Apache-2.0 Open Source License:** Enterprise-friendly permissive licensing.
