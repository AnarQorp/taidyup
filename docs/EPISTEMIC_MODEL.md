# TAIDYUP EPISTEMIC MODEL & VALIDATION AXIOMS

## Overview
tAIdyup enforces strict mathematical and logical boundaries on claim states:

$$\text{DECLARED} \neq \text{VERIFIED}$$
$$\text{OBSERVED} \neq \text{AUTHORIZED}$$
$$\text{IMPLEMENTED} \neq \text{ENABLED}$$
$$\text{ENABLED} \neq \text{EXECUTED}$$
$$\text{EXECUTED} \neq \text{AUTHORIZED}$$
$$\text{AUTHORIZED} \neq \text{COMPLIANT}$$
$$\text{NOT\_OBSERVED} \neq \text{FALSE}$$
$$\text{UNKNOWN} \neq \text{COMPLIANT}$$

## Evidence layers

`STATIC` is the implementation name for local `OBSERVED` evidence from source code or supported workflow artifacts. `CONNECTED` is provider-neutral, point-in-time evidence reported by an explicitly queried external source. Neither layer establishes authorization, execution, safety, or compliance, and the layer itself is not a confidence score.

CONNECTED reconciliation uses explicit snapshot semantics:

- Positive facts may be used from complete or partial snapshots.
- Absence is never inferred from silence. `ABSENCE_OBSERVED` applies only after a successful, `COMPLETE`, explicitly scoped snapshot.
- Absence can supersede a positive fact for current assessment only when source instance and scope identities match and its timestamp is not older.
- Failed, denied, partial, malformed, or identity-incomparable observations cannot establish absence.
- Later comparable CONNECTED evidence governs current-state assessment while prior evidence remains in provenance.
- STATIC and CONNECTED are compared only after existing subject and resource dimensions establish an exact relationship. Display-name similarity never establishes continuity.

A current complete absence changes a previously supported positive declaration to `UNVERIFIED`, with `CURRENT_STATE_DRIFT` and `CONNECTED_ABSENCE_OBSERVED` diagnostics. It is not `CONFLICT`: the historical artifact observation remains true, and a `CAN` declaration is not logically prohibited by current absence. `CONFLICT` remains reserved for evidence that contradicts the declaration itself. Additional strong CONNECTED capabilities can surface as `UNDECLARED_OBSERVATION` without becoming authorized.

---

## State Definitions
* **`DECLARED`:** Claim originates from a developer declaration manifest.
* **`OBSERVED`:** Claim originates from static code analysis or AST signals.
* **`SUPPORTED`:** Manifest declaration is matched by compatible `AGENT_BOUND` code evidence.
* **`UNVERIFIED`:** Manifest declaration lacks supporting code evidence.
* **`CONFLICT`:** Manifest declared prohibition/absence contradicts active agent binding in code.
* **`UNDECLARED`:** Code analysis observed an active agent-bound capability not listed in manifest.
* **`UNKNOWN`:** Evidence is ambiguous or insufficient.
