# TAIDYUP EPISTEMIC MODEL & VALIDATION AXIOMS

## Overview
tAIdyup enforces strict mathematical and logical boundaries on claim states:

$$\text{DECLARED} \neq \text{VERIFIED}$$
$$\text{OBSERVED} \neq \text{AUTHORIZED}$$
$$\text{CONNECTED} \neq \text{AUTHORIZED}$$
$$\text{IMPLEMENTED} \neq \text{ENABLED}$$
$$\text{ENABLED} \neq \text{EXECUTED}$$
$$\text{EXECUTED} \neq \text{AUTHORIZED}$$
$$\text{AUTHORIZED} \neq \text{COMPLIANT}$$
$$\text{NOT\_OBSERVED} \neq \text{FALSE}$$
$$\text{UNKNOWN} \neq \text{COMPLIANT}$$
$$\text{UNKNOWN} \neq \text{FAILURE}$$

## Four evidence dimensions

- **`DECLARED`**: optional owner-reviewed intent from a supported JSON declaration. When no declaration is supplied, `declarationContext` is `ABSENT`; tAIdyup does not infer intended authority.
- **`OBSERVED`**: supported local source-code and workflow-artifact evidence. `STATIC` is the internal evidence-layer name used for this dimension.
- **`CONNECTED`**: explicit opt-in, provider-neutral, point-in-time current-configuration evidence.
- **`RUNTIME`**: explicit sanitized local lifecycle evidence. It remains orthogonal to authority reconciliation and does not prove a complete execution history.

No dimension establishes authorization, safety, compliance, or universal truth, and a dimension is not a confidence score.

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
* **`OBSERVED`:** Claim originates from supported local source or workflow evidence.
* **`CONNECTED`:** Evidence originates from an explicitly requested point-in-time provider inspection.
* **`RUNTIME`:** Evidence originates from an explicitly imported sanitized lifecycle artifact; it never boosts authority state.
* **`SUPPORTED`:** Every mandatory declaration dimension is matched by sufficient compatible STATIC and/or CONNECTED evidence under the current Trust Kernel rules. RUNTIME remains orthogonal and does not boost authority.
* **`UNVERIFIED`:** One or more mandatory declaration dimensions lack sufficient compatible evidence.
* **`CONFLICT`:** Manifest declared prohibition/absence contradicts active agent binding in code.
* **`UNDECLARED_OBSERVATION`:** Compatible agent-bound evidence supports a capability not covered by a supplied declaration. If declarations are absent, this is neutral observation context rather than an accusation.
* **`UNKNOWN`:** Evidence is ambiguous or insufficient.
