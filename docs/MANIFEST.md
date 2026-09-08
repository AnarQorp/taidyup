# TAIDYUP DECLARATION MANIFEST V0 SPECIFICATION

## Overview
The optional **tAIdyup Declaration Manifest** (`taidyup.json`) is an experimental, portable JSON input where AI developers declare identity, intended purpose, owner accountability, tools, capabilities, and oversight gates for their AI agents. Local observation works without a manifest; in that case `declarationContext` is `ABSENT` and intended authority is not inferred.

Alpha 3 does not implement real YAML parsing. A discovered `taidyup.yaml` is treated as a declaration source and must parse as JSON-compatible content; ordinary YAML syntax is invalid and is never silently treated as `ABSENT`. JSON in `taidyup.json` is the supported format.

---

## Schema Overview

```json
{
  "version": "1.0",
  "project": "finance-app",
  "agents": [{
    "id": "invoice-agent",
    "name": "Invoice Processing Agent",
    "purpose": "Reads incoming customer invoices",
    "owner": { "name": "Finance Engineering Team", "email": "fin-eng@company.com" },
    "capabilities": [{ "action": "READ", "resource": "postgres:invoices" }]
  }]
}
```

---

## Transition Rules: DRAFT vs DECLARED
1. **`GENERATED_DRAFT` (`taidyup.json.draft`):** Created automatically by `taidyup init`. Contains candidate suggestions inferred from code. **NOT** a developer declaration.
2. **`DECLARED` (`taidyup.json`):** Created only after the owner explicitly completes a valid declaration in the draft's `agents[]` and runs `taidyup init --accept`. Candidate suggestions are not copied into this file. The Reconciliation Engine treats only this accepted manifest as developer intent.

Neither a declaration nor a `SUPPORTED` reconciliation establishes verified identity, execution, authorization, safety, or compliance.
