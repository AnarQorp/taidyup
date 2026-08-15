# TAIDYUP DECLARATION MANIFEST V0 SPECIFICATION

## Overview
The **tAIdyup Declaration Manifest** (`taidyup.json` or `taidyup.yaml`) is an experimental, portable input format where AI developers declare the identity, intended purpose, owner accountability, tools, capabilities, and oversight gates of their AI agents.

---

## Schema Overview

```yaml
version: "1.0"
project: "finance-app"

agents:
  - id: "invoice-agent"
    name: "Invoice Processing Agent"
    purpose: "Reads incoming customer invoices and charges payments"
    owner:
      name: "Finance Engineering Team"
      email: "fin-eng@company.com"
    capabilities:
      - action: READ
        resource: "postgres:invoices"
      - action: PURCHASE
        resource: "api:stripe"
        constraints:
          max_amount: "500 EUR"
    oversight:
      human_in_the_loop: true
      approval_required: "amount > 500 EUR"
```

---

## Transition Rules: DRAFT vs DECLARED
1. **`GENERATED_DRAFT` (`taidyup.json.draft`):** Created automatically by `taidyup init`. Contains candidate suggestions inferred from code. **NOT** a developer declaration.
2. **`DECLARED` (`taidyup.json`):** Created when the developer explicitly reviews, confirms, or accepts the draft. The Reconciliation Engine treats this file as developer intent.
