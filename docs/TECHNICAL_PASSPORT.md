# TECHNICAL PASSPORT V0 SPECIFICATION

## Overview
The **tAIdyup Technical Passport** (`TECHNICAL_PASSPORT.md`) is a portable, human-readable delivery document created by an AI developer for their client or technical auditor.

It summarizes optional declared intent, OBSERVED/CONNECTED evidence, orthogonal RUNTIME observations, supported capability bindings, unverified claims, and technical findings. It does not certify authorization, safety, security, or compliance.

---

## Standard Passport Structure

```markdown
# TAIDYUP TECHNICAL PASSPORT & VALIDATION REPORT

**Project:** `customer-support-agent`
**Timestamp:** `2026-08-15T19:40:00Z`
**Trust Kernel Version:** `1.0.0`
**Declaration source:** `PRESENT` or `ABSENT`

## SUMMARY METRICS
* Total Claims Evaluated: 12
* Supported Implementation Claims: 8
* Unverified Claims: 2
* Declaration Conflicts: 0
* Undeclared Observations: 1
* Critical Technical Findings: 1

## RECONCILED CLAIMS DETAIL

The report identifies the Trust Kernel **schema version**. This is not the npm package version. When runtime evidence is explicitly supplied, each claim keeps authority state and the orthogonal runtime assessment separate, including lifecycle, source-reported outcome, partial coverage, binding and evidence references.
### ✅ `agent:support` — CAN READ resource:zendesk
* Status: `SUPPORTED`
* Provenance: `src/agent.ts:42`

### 🔍 `agent:support` — CAN EXECUTE resource:shell
* Status: `UNDECLARED_OBSERVATION`
* Provenance: `src/tools/shell.ts:15`

## TECHNICAL FINDINGS & CONFLICTS
### 💥 [CRITICAL] Undeclared Critical Capability: EXECUTE
Compatible local evidence supports agent-bound EXECUTE on resource "system:bash" without a compatible owner declaration. This does not establish execution or authorization.
```

---

## Prohibited Terms
The Technical Passport must never contain:
- Prohibited term: `EU AI ACT COMPLIANT`
- Prohibited term: `CERTIFIED SECURE`
- Prohibited term: `100% SECURE`
- Prohibited term: `IMMUTABLE EVIDENCE`
- Prohibited term: `ZERO KNOWLEDGE`

`DECLARED != VERIFIED`, `OBSERVED != AUTHORIZED`, `EXECUTED != AUTHORIZED`, `AUTHORIZED != COMPLIANT`, and `UNKNOWN != FAILURE` apply to every Passport.
