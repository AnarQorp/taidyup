<div align="center">

# tAIdyup

### Know your AI while you build it.

**The local-first developer tool for understanding, checking and evidencing what your AI can actually do.**

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

Static scanner observed agent-bound critical capability
EXECUTE on resource "Terminal / OS Shell"
that was NOT declared in the project manifest.

Observed:
  src/script.ts
```

Now the question becomes actionable:

**Should the agent have this authority?**

If yes, declare it.

If no, remove it.

If you don't know, investigate it.

What matters is that it is no longer invisible.

---

# A development tool, not an after-the-fact questionnaire

Traditional compliance work often starts late.

The system is already built and somebody has to reconstruct:

* what components it uses;
* what capabilities exist;
* what was intended;
* what changed;
* where those capabilities originate;
* and what evidence supports the answers.

tAIdyup approaches the problem from the opposite direction.

```text
DECLARE → OBSERVE → RECONCILE → EVIDENCE
```

Make technical understanding part of building the AI itself.

That makes tAIdyup useful long before anybody asks you for a compliance report.

---

# Build → Check → Understand → Repeat

tAIdyup Alpha 1 provides five primary CLI operations:

```bash
taidyup init
taidyup scan .
taidyup validate .
taidyup report
taidyup diff <previous-report> <current-report>
```

They support different moments in the development lifecycle.

### Start

```bash
taidyup init
```

Create the declaration manifest that describes the intended system.

### Develop

```bash
taidyup scan .
```

Inspect the project for observable AI assets, framework bindings, tools and capabilities.

### Check

```bash
taidyup validate .
```

Reconcile declared authority against observable implementation.

### Understand change

```bash
taidyup diff previous-report.json current-report.json
```

See how the system's authority changed between two states.

### Prove

```bash
taidyup report
```

Generate portable technical evidence from the reconciled state.

---

# What authority did your AI gain between releases?

This is one of the questions tAIdyup is designed to make answerable.

Imagine version 1 of your agent can read project data.

Version 2 introduces process execution.

Compare both tAIdyup reports:

```bash
taidyup diff taidyup-report-v1.json taidyup-report-v2.json
```

Example Alpha 1 output:

```text
TAIDYUP AUTHORITY DIFF

[NEW CAPABILITIES]

  + agent:...:EXECUTE:Terminal / OS Shell
```

That creates a different way of reviewing AI changes.

A normal code diff asks:

> **What code changed?**

tAIdyup can help you ask:

> **What authority changed because the code changed?**

That's useful during development.

It's useful during review.

And it's especially useful before a release reaches a client or production environment.

---

# Five epistemic states

tAIdyup deliberately avoids pretending to know more than the available evidence supports.

### `SUPPORTED`

Declared authority is supported by observable implementation evidence.

### `UNVERIFIED`

A declaration exists, but available evidence cannot verify it.

### `CONFLICT`

Observed implementation contradicts an explicit declaration.

### `UNDECLARED_OBSERVATION`

Relevant authority is observable in the implementation but was not declared.

### `UNKNOWN`

Available evidence is insufficient or ambiguous.

This is the core epistemic principle behind tAIdyup:

> **Evidence before claims.**

When tAIdyup doesn't know, it should say that it doesn't know.

---

# Evidence should tell you where it came from

A finding without provenance isn't enough.

tAIdyup connects reconciled claims to their technical origin.

```text
taidyup.json
agents[0].capabilities[0]
        │
        │  CANNOT EXECUTE
        ▼
     CONFLICT
        ▲
        │  EXECUTE observed
        │
src/agent.ts
```

That allows developers to move from:

> "Something might be wrong."

to:

> "This declaration conflicts with this observable implementation, here."

Provenance also travels into generated technical reports.

---

# Your project's evolving technical record

tAIdyup records evidence locally using a SQLite-backed SHA-256 hash chain.

Evidence records incorporate the preceding record's hash, allowing chain verification to detect historical mutation, insertion or deletion.

This creates the foundation for maintaining a technical record as the AI project evolves.

But tAIdyup does not pretend that this proves more than it does.

The Alpha 1 evidence chain is:

**a local cryptographic hash chain.**

It is not:

* a blockchain;
* an external notarization service;
* a consensus mechanism;
* a trusted timestamp authority.

And an attacker with sufficient database write access could recalculate the chain without additional external trust or key-management mechanisms.

**Evidence should never claim more than it proves.**

---

# Technical Passports

When you need to communicate the technical state of the system, run:

```bash
taidyup report
```

tAIdyup generates:

```text
TECHNICAL_PASSPORT.md
```

The passport contains the reconciled technical state of the inspected project.

Example:

```text
TAIDYUP TECHNICAL PASSPORT & VALIDATION REPORT

Project: customer-support-app

SUMMARY METRICS

Total Claims Evaluated:            4
Supported Implementation Claims:  0
Unverified Claims:                 2
Declaration Conflicts:             1
Undeclared Observations:           0
Critical Governance Findings:      1


🚨 CANNOT EXECUTE Terminal / OS Shell

Status:      CONFLICT
Source:      DECLARATION
Confidence:  95%

Provenance:
  taidyup.json:agents[0].capabilities[0]
  src/agent.ts
```

The Technical Passport is designed to travel with the project as technical evidence for developers, clients and technical review processes.

---

# From development evidence to compliance evidence

Compliance shouldn't require rediscovering how an AI system works after it has already been built.

By continuously making intended authority, observable implementation, changes and provenance explicit, tAIdyup creates technical evidence that can later support governance and compliance workflows.

That distinction is important:

```text
DEVELOP
   │
   │ understand the system
   ▼
EVIDENCE
   │
   │ preserve what can be demonstrated
   ▼
DELIVER / REVIEW / AUDIT
   │
   │ provide technical inputs
   ▼
COMPLIANCE
```

tAIdyup operates primarily in the technical layers.

Legal determination remains where it belongs.

---

# EU AI Act

tAIdyup is being developed with the European AI governance landscape in mind, including the EU AI Act.

Alpha 1 can help developers:

* document intended AI capabilities;
* identify observable capabilities in code;
* detect contradictions and undeclared authority;
* preserve technical provenance;
* generate evidence-backed technical documentation;
* support transparency-oriented engineering workflows.

tAIdyup can also provide a handoff to the official European Commission compliance checker tool for regulatory assessment.

### What tAIdyup does not do

tAIdyup does **not**:

* declare that your AI system is EU AI Act compliant;
* automatically classify systems as high-risk or low-risk;
* replace contextual assessment under Article 6 / Annex III;
* issue legal certifications;
* replace legal or regulatory review.

Code can provide evidence about technical properties.

Code alone cannot determine the complete legal context in which an AI system operates.

---

# Local-first

Your source code is often one of the most sensitive assets in your organization.

Understanding your AI shouldn't require uploading it somewhere else.

Alpha 1 performs normal analysis locally.

```text
taidyup init
taidyup scan
taidyup validate
taidyup report
taidyup diff
```

These operations:

* make no outbound HTTP/HTTPS/WebSocket requests;
* upload no inspected source code;
* send no telemetry;
* perform no automated update checks;
* require no tAIdyup SaaS backend.

Your code stays on your machine.

---

# AI ecosystems detected in Alpha 1

Current detector coverage includes:

| Ecosystem       | Detection | Fixture tested | Adversarial tested |
| --------------- | --------: | -------------: | -----------------: |
| LangChain       |         ✅ |              ✅ |                  ✅ |
| LangGraph       |         ✅ |              ✅ |                  ✅ |
| CrewAI          |         ✅ |              ✅ |                  ✅ |
| AutoGen         |         ✅ |              ✅ |                  ✅ |
| LlamaIndex      |         ✅ |              ✅ |                  ✅ |
| Semantic Kernel |         ✅ |              ✅ |                  ✅ |
| MCP             |         ✅ |              ✅ |                  ✅ |

Framework detection does not imply that every possible runtime behavior can be inferred through static analysis.

---

# SARIF and existing development workflows

tAIdyup exports **OASIS SARIF 2.1.0**:

```text
taidyup.sarif
```

Findings such as declaration conflicts and undeclared critical capabilities can therefore enter existing code-scanning workflows.

Example:

```json
{
  "id": "TA001",
  "name": "DeclarationConflict",
  "shortDescription": {
    "text": "Manifest declaration contradicts observed code binding"
  },
  "defaultConfiguration": {
    "level": "error"
  }
}
```

Alpha 1 SARIF output is compatible with GitHub Code Scanning through:

```text
github/codeql-action/upload-sarif@v3
```

This allows tAIdyup findings to become part of the engineering workflow instead of living in a separate compliance silo.

---

# What Alpha 1 cannot see

Knowing the boundaries of evidence is part of tAIdyup's design.

Static analysis cannot reliably determine:

* future user inputs;
* dynamically generated prompts;
* every runtime branch;
* behavior of remote services;
* dynamically loaded code;
* deployment context;
* legal purpose;
* complete regulatory classification.

Alpha 1 therefore does not perform dynamic sandbox execution.

When static evidence isn't enough, tAIdyup preserves that uncertainty rather than silently turning it into certainty.

Runtime evidence collection is part of the project's future direction.

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

Package:

```text
taidyup-0.1.0-alpha.1.tgz
```

SHA-256:

```text
9a0b8b8a0df23f9f891a5bcd60cbc1790281af919de25299e416bf4b9b0694fe
```

---

# Where tAIdyup is going

Alpha 1 establishes the first part of a larger idea:

> **AI systems should carry an evolving, evidence-backed technical understanding of what they are and what authority they possess.**

Today tAIdyup can reconcile declared authority with statically observable implementation.

The next steps explore how that evidence can follow increasingly dynamic AI systems throughout their lifecycle.

### Runtime evidence

Extend static observations with runtime telemetry so future tAIdyup versions can incorporate evidence about what AI systems actually do during execution — while continuing to distinguish observation from inference.

### Open Agent Trust Manifest

Explore evolution of the current declaration format into an interoperable specification for describing AI and agent authority.

### Detector Plugin SDK

Allow frameworks and developer communities to extend tAIdyup's detection model without coupling every ecosystem to the core engine.

And as AI governance evolves, the same technical evidence layer can support additional regulatory, assurance and audit workflows without turning the engineering tool itself into a legal oracle.

---

# The idea

AI development is changing.

We are no longer building software that only responds to inputs.

AI systems increasingly:

**read.
write.
reason.
call tools.
access services.
use credentials.
execute.
delegate.
act.**

That makes authority part of AI engineering.

Developers need to understand that authority while they build — not reconstruct it after something goes wrong or somebody asks for an audit.

So tAIdyup asks continuously:

> **What are we saying this AI can do?**

> **What does the implementation show that it can do?**

> **Where does that authority come from?**

> **What changed?**

> **What evidence do we have?**

And when it's time to ship:

> **Are we delivering the AI we intended to build?**

---

<div align="center">

## Build AI with evidence, not assumptions.

### Know your AI while you build it.

**tAIdyup**

Open source · Local-first · Alpha

</div>
