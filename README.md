<div align="center">

<img src="docs/assets/brand/taidyup-logo.png" alt="tAIdyup Logo" width="440" />

# tAIdyup

### Know your AI while you build it.

**The local-first developer tool for understanding, checking and evidencing what your AI can actually do.**

[![npm alpha](https://img.shields.io/npm/v/taidyup/alpha?color=2563eb&label=npm%20alpha)](https://www.npmjs.com/package/taidyup)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](package.json)
[![privacy](https://img.shields.io/badge/privacy-100%25%20local--first-emerald.svg)](#privacy--local-first-guarantee)
[![build](https://img.shields.io/badge/tests-100%25%20passing-brightgreen.svg)](#alpha-1-verification)

```bash
npm install -g taidyup@alpha
```

</div>

---

## Your AI changes every time your code does.

You add a tool.

Connect an MCP server.

Introduce filesystem access.

Change a framework.

Give an agent access to a database.

Add process execution.

Update a dependency.

The project still looks like the same AI application.

But its **authority may have changed**.

And when somebody eventually asks:

> What can this AI actually do?
> Where does that capability come from?
> Was it intentional?
> When was it introduced?
> Does the implementation match what we say it does?
> Can you prove it?

...the worst time to start looking for those answers is after the system has already been built.

**tAIdyup makes those questions part of development.**

```text
        BUILD
          │
          ▼
       tAIdyup
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
 UNDERSTAND  CHECK  EVIDENCE
    │     │     │
    └─────┼─────┘
          ▼
        BUILD
          │
          ▼
       tAIdyup
          │
          ▼
        SHIP
```

Run it while you build.

Run it when authority changes.

Run it before a release.

And when a client, auditor or regulatory process asks for evidence, you don't have to reconstruct the story of your AI from scratch.

**You've been building that evidence along the way.**

---

# What does tAIdyup do?

tAIdyup maintains a distinction between two things that are often treated as if they were the same:

### What you intended your AI to be able to do

and

### What its implementation observably enables it to do

It then reconciles the two.

```text
        DECLARED
        AUTHORITY
            │
            ▼
     ┌──────────────┐
     │              │
     │   tAIdyup    │
     │ Trust Kernel │
     │              │
     └──────────────┘
            ▲
            │
        OBSERVED
     IMPLEMENTATION
```

The result is not simply PASS or FAIL.

tAIdyup preserves what it actually knows.

```text
SUPPORTED
UNVERIFIED
CONFLICT
UNDECLARED_OBSERVATION
UNKNOWN
```

Because a declaration is not evidence.

An observation is not certainty.

And neither one, by itself, is a legal conclusion.

---

# See the difference before it becomes a problem

Suppose your project declares:

```json
{
  "capabilities": [
    {
      "predicate": "CANNOT",
      "action": "EXECUTE",
      "resource": "Terminal / OS Shell"
    }
  ]
}
```

But during development someone introduces:

```typescript
import { exec } from 'child_process';

exec('rm -rf /tmp/data');
```

Run:

```bash
taidyup validate .
```

And tAIdyup surfaces the contradiction:

```text
🚨 CONFLICT

CANNOT EXECUTE Terminal / OS Shell

Explicit Declaration Conflict:
Manifest declared prohibition (CANNOT) for EXECUTE,
but static analysis observed active agent binding in code.

Declared:
  taidyup.json:agents[0].capabilities[0]

Observed:
  src/agent.ts
```

The important part isn't just that tAIdyup found `child_process`.

It's that the observation **contradicts the authority you explicitly intended for the agent**.

---

# And find what nobody declared

The inverse matters too.

An AI project may acquire authority without anybody updating its documentation.

For example, tAIdyup can observe:

```text
🔍 UNDECLARED

CAN EXECUTE Terminal / OS Shell
```

and surface:

```text
CRITICAL — Undeclared Critical Capability

Observation:
  EXECUTE on Terminal / OS Shell

Provenance:
  src/agent.ts
```

That allows you to decide intentionally:

* Should this capability be removed?
* Or should the project declaration be updated to reflect it?

Without tAIdyup, that capability might have remained unnoticed until release.

---

# The 5 Epistemic States of tAIdyup

When tAIdyup runs `validate`, every claim is classified into one of 5 distinct epistemic states:

| Epistemic State | Meaning | Action Needed |
| :--- | :--- | :--- |
| **`SUPPORTED`** | Manifest claim is directly matched by compatible AST code evidence. | ✅ None. Implementation aligns with declaration. |
| **`UNVERIFIED`** | Manifest claim lacks code evidence in the static AST scan. | ⚠️ Review. Claim may depend on external or runtime code. |
| **`CONFLICT`** | Manifest declared prohibition (`CANNOT`) is contradicted by active code. | 🚨 Fix code or update declaration to resolve contradiction. |
| **`UNDECLARED_OBSERVATION`** | Active critical capability observed in code but omitted from manifest. | 🔍 Review. Intended authority or accidental capability leak? |
| **`UNKNOWN`** | Static evidence is ambiguous or incomplete. | ❓ Further inspection or runtime telemetry needed. |

---

# Track authority changes over time: `taidyup diff`

AI applications evolve continuously.

When you update a dependency, add an agent tool, or refactor logic, compare your previous release report with your current analysis:

```bash
taidyup diff base-report.json target-report.json
```

Output:

```text
TAIDYUP AUTHORITY DIFF
Base:   2026-08-15T20:27:13.911Z
Target: 2026-08-15T20:27:14.075Z

[NEW CAPABILITIES]
  + agent:asset-a2c42e7b:EXECUTE:Terminal / OS Shell
```

You immediately see what authority changed between builds.

---

# What tAIdyup generates

When you run `taidyup report`, tAIdyup generates 3 evidence artifacts in your project:

### 1. `taidyup-report.json`
Complete machine-readable audit report containing claim reconciliation matrix, capability bindings, and source provenance.

### 2. `TECHNICAL_PASSPORT.md`
Human-readable technical passport summarizing agent assets, declared vs observed capabilities, and evidence findings for clients or team leads.

### 3. `taidyup.sarif`
OASIS SARIF v2.1.0 static analysis report compatible with **GitHub Code Scanning** and CI/CD security tab integration (`github/codeql-action/upload-sarif@v3`).

---

# Supported Framework Ecosystems

tAIdyup static analysis currently supports automatic capability detection for:

* **LangChain / LangGraph** (Python & TypeScript)
* **CrewAI** (Python)
* **AutoGen** (Python)
* **LlamaIndex** (Python & TypeScript)
* **Semantic Kernel** (Python & C#)
* **MCP — Model Context Protocol** (`mcp.json` servers & tool schemas)

---

# Privacy & Local-First Guarantee

tAIdyup is designed with local-first privacy guarantees:

* **100% Local Execution:** 0 outbound network requests during analysis.
* **0 Code Uploads:** Your source code never leaves your workstation or CI server.
* **0 Telemetry:** No tracking, metrics, or external analytics calls.

---

# What tAIdyup does not do

tAIdyup does **not**:

* declare that your AI system is EU AI Act compliant;
* automatically classify systems as high-risk or low-risk;
* replace contextual assessment under Article 6 / Annex III;
* issue legal certifications;
* replace legal or regulatory review.

Code can provide evidence about technical properties.

Code alone cannot determine the complete legal context in which an AI system operates.

---

## 🧪 Early Alpha — Help us test tAIdyup on real AI projects

We are looking for developers willing to run `tAIdyup` against AI projects we haven't seen before.

Found a false positive? A capability we missed? A framework we don't understand yet? Tell us:

* 🐞 [Report a CLI bug](https://github.com/AnarQorp/taidyup/issues/new?template=bug_report.md)
* 🔍 [Report detection feedback or false positive](https://github.com/AnarQorp/taidyup/issues/new?template=detection_feedback.md)
* 🔌 [Request framework or detector support](https://github.com/AnarQorp/taidyup/issues/new?template=framework_request.md)
* 💡 [Suggest a feature](https://github.com/AnarQorp/taidyup/issues/new?template=feature_request.md)
* 💬 [Share your Early Alpha experience ("I tried tAIdyup")](https://github.com/AnarQorp/taidyup/issues/new?template=alpha_feedback.md)

---

# Quick start

> **tAIdyup 0.1.0-alpha.1 is an early release. Interfaces and schemas may evolve.**

### Requirements

* Node.js 18+

### Install

For the current Alpha release:

```bash
npm install -g taidyup@alpha
```

Once stable releases are published, standard installation will be:

```bash
npm install -g taidyup
```

### Initialize your AI project

```bash
cd your-ai-project

taidyup init
```

### Inspect it

```bash
taidyup scan .
```

### Reconcile implementation and intent

```bash
taidyup validate .
```

### Generate evidence

```bash
taidyup report
```

### Compare two releases

```bash
taidyup diff previous-report.json current-report.json
```

---

# Alpha 1 verification

The current release has passed:

```text
✓ Unit & integration suite
✓ Trust Kernel adversarial suite — 100/100 scenarios
✓ Realistic developer fixtures — 5/5
✓ Real-world dogfood repositories — 3/3
✓ TypeScript & frontend production build
✓ Safety-language audit — 0 prohibited overclaims
✓ TrustAgent legacy audit — 0 remaining public references
```

Package details: `taidyup@0.1.0-alpha.1` on npm.

---

# Brand & Inspiration

tAIdyup's visual identity is inspired by Pinocchio and handcrafted wooden block mechanics — representing creation, development, discovery, and evidence-backed understanding.

To learn more about the brand identity, materials, and positioning, see [docs/BRAND_IDENTITY.md](docs/BRAND_IDENTITY.md).

---

<div align="center">

<img src="docs/assets/brand/taidyup-mark.png" alt="tAIdyup Mark" width="80" />

### Know your AI while you build it.

**tAIdyup** — Open source · Local-first · Alpha

</div>
