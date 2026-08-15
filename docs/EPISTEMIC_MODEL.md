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

---

## State Definitions
* **`DECLARED`:** Claim originates from a developer declaration manifest.
* **`OBSERVED`:** Claim originates from static code analysis or AST signals.
* **`SUPPORTED`:** Manifest declaration is matched by compatible `AGENT_BOUND` code evidence.
* **`UNVERIFIED`:** Manifest declaration lacks supporting code evidence.
* **`CONFLICT`:** Manifest declared prohibition/absence contradicts active agent binding in code.
* **`UNDECLARED`:** Code analysis observed an active agent-bound capability not listed in manifest.
* **`UNKNOWN`:** Evidence is ambiguous or insufficient.
