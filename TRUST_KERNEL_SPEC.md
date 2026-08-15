# TRUST KERNEL SPECIFICATION V1.0

## 1. Overview & Purpose
The tAIdyup Trust Kernel (`src/trust-kernel/`) is a pure, zero-dependency, local-first engine responsible for evaluating developer claims against observed technical evidence.

It acts as the core evidence reconciliation engine for tAIdyup.

---

## 2. Inviolable Architectural Principles
1. **Zero External Dependencies:** No React, Express, SQLite, SaaS Cloud, or AnarQ dependencies.
2. **Collectors Observe, Kernel Reconciles:** Collectors (scanners, manifest parsers, API connectors) only produce raw evidence. The Trust Kernel alone computes epistemic states and technical findings.
3. **Deterministic Execution:** The same claims and evidence inputs always produce byte-for-byte identical output.
4. **Epistemic Integrity:** Enforces the core axioms:
   $$\text{DECLARED} \neq \text{VERIFIED} \qquad \text{OBSERVED} \neq \text{AUTHORIZED} \qquad \text{IMPLEMENTED} \neq \text{ENABLED}$$

---

## 3. Core Modules
* **`src/trust-kernel/types.ts`:** First-class `Claim`, `Evidence`, `EpistemicState`, and `TechnicalFinding` interfaces.
* **`src/trust-kernel/manifestParser.ts`:** tAIdyup Declaration Manifest V0 parser and validator.
* **`src/trust-kernel/reconciliationEngine.ts`:** Multi-source reconciliation engine implementing `RECONCILIATION_RULES_V1.md`.
* **`src/trust-kernel/scannerAdapter.ts`:** Adapter wrapping `ScannerCore` output into `STATIC` evidence.
* **`src/trust-kernel/reportGenerator.ts`:** Markdown & JSON validation report generator.

---

## 4. Input & Output Schemas
### Input:
* `inputClaims: Claim[]`
* `inputEvidences: Evidence[]`

### Output (`ReconciledTrustState`):
* `schemaVersion: string`
* `timestamp: string`
* `summary: SummaryMetrics`
* `reconciledClaims: Claim[]`
* `findings: TechnicalFinding[]`
