# RECONCILIATION RULES V1 SPECIFICATION

## Core Principle
The tAIdyup Reconciliation Engine ingests claims and evidence from multiple independent sources (Declarations, Static Scans, Connected APIs, Runtime Logs) and applies deterministic reconciliation rules to compute explicit epistemic states (`DECLARED`, `OBSERVED`, `SUPPORTED`, `UNVERIFIED`, `CONFLICT`, `UNDECLARED_OBSERVATION`, `NOT_OBSERVED`, `UNKNOWN`).

---

## Reconciliation Rule Matrix

### Rule A: DECLARED Capability + Compatible Strong Observation
* **Condition:** Manifest declares Capability $C(A, R)$ AND static scanner observes $C(A, R)$ with `strength >= AGENT_BOUND`.
* **Output State:** `SUPPORTED` (Implementation Binding Supported).
* **Authorization State:** `DECLARED / UNVERIFIED` (Unless connected API / IAM authorization evidence is present).

### Rule B: DECLARED Capability + No Supporting Evidence
* **Condition:** Manifest declares Capability $C(A, R)$ BUT no code evidence or binding is observed.
* **Output State:** `UNVERIFIED`.

### Rule C: DECLARED Prohibition / Absence + Contradictory Strong Observation
* **Condition:** Manifest explicitly forbids Capability $C(A, R)$ or declares zero capabilities BUT static scanner observes $C(A, R)$ with `strength >= AGENT_BOUND`.
* **Output State:** `CONFLICT`.
* **Finding Generated:** `DECLARATION_CONFLICT` (High / Critical Severity).

### Rule D: Strong Agent-Bound Observation + Not Declared
* **Condition:** Static scanner observes $C(A, R)$ with `strength >= AGENT_BOUND` BUT $C(A, R)$ is missing from manifest declarations.
* **Output State:** `UNDECLARED_OBSERVATION`.
* **Finding Generated:** `UNDECLARED_CRITICAL_CAPABILITY` if action is critical (`DELETE`, `EXECUTE`, `SEND`, etc.).

### Rule E: Weak Functionality Signal + Not Declared
* **Condition:** Utility function or dependency exists (`strength <= FUNCTION_DEFINED`) BUT is NOT bound to an agent and NOT declared.
* **Output State:** `POTENTIAL_ONLY` / `OBSERVED`.
* **Conflict Result:** **NO CONFLICT**. (Prevents false alarms from raw dependencies).

### Rule F: Insufficient Evidence
* **Condition:** Evidence strength or provenance is ambiguous.
* **Output State:** `UNKNOWN`.

---

## Critical Capabilities Policy
Critical Actions: `DELETE`, `EXECUTE`, `SEND`, `PUBLISH`, `APPROVE`, `PURCHASE`, `TRANSFER`, `ADMIN`.

1. Weak evidence (`DEPENDENCY_ONLY`, `IMPORT_OBSERVED`, `FUNCTION_DEFINED`) must **NEVER** promote a critical claim to `SUPPORTED` or `VERIFIED`.
2. Critical capabilities require **`AGENT_BOUND`** or **`ENTRYPOINT_REACHABLE`** to achieve `SUPPORTED` implementation binding.
3. `AGENT_BOUND` binding supports implementation, but does **NOT** prove legal or organizational authorization.

---

## Subject Isolation Policy
* Evidence with `subjectType = CONNECTOR` cannot satisfy an `AGENT` control without an explicit relationship mapping.
* Evidence with `subjectType = ORGANIZATION` cannot automatically satisfy all `AGENT` controls.
* Evidence for `TOOL` does not become `AGENT` capability without an observed agent-tool binding edge.
