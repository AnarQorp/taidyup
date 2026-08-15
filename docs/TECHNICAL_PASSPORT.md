# TECHNICAL PASSPORT V0 SPECIFICATION

## Overview
The **tAIdyup Technical Passport** (`TECHNICAL_PASSPORT.md`) is a portable, human-readable delivery document created by an AI developer for their client or technical auditor.

It summarizes the declared architecture, observable technical evidence, supported capability bindings, unverified claims, and critical governance findings.

---

## Standard Passport Structure

```markdown
# TAIDYUP TECHNICAL PASSPORT & VALIDATION REPORT

**Project:** `customer-support-agent`
**Timestamp:** `2026-08-15T19:40:00Z`
**Trust Kernel Version:** `1.0.0`

## SUMMARY METRICS
* Total Claims Evaluated: 12
* Supported Implementation Claims: 8
* Unverified Claims: 2
* Declaration Conflicts: 0
* Undeclared Observations: 1
* Critical Governance Findings: 1

## RECONCILED CLAIMS DETAIL
### ✅ `agent:support` — CAN READ resource:zendesk
* Status: `SUPPORTED`
* Provenance: `src/agent.ts:42`

### 🔍 `agent:support` — CAN EXECUTE resource:shell
* Status: `UNDECLARED_OBSERVATION`
* Provenance: `src/tools/shell.ts:15`

## TECHNICAL FINDINGS & CONFLICTS
### 💥 [CRITICAL] Undeclared Critical Capability: EXECUTE
Static scanner observed agent-bound critical capability EXECUTE on resource "system:bash" that was NOT declared in taidyup.json.
```

---

## Prohibited Terms
The Technical Passport must never contain:
- Prohibited term: `EU AI ACT COMPLIANT`
- Prohibited term: `CERTIFIED SECURE`
- Prohibited term: `100% SECURE`
- Prohibited term: `IMMUTABLE EVIDENCE`
- Prohibited term: `ZERO KNOWLEDGE`
