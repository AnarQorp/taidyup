# tAIdyup 0.1.0-alpha.3 — Release Draft

Status: **release candidate; unpublished**

- Proposed tag: `v0.1.0-alpha.3`
- Proposed title: `tAIdyup 0.1.0-alpha.3`

## Proposed release notes

Alpha 3 consolidates the product already integrated on Git main into a coherent release candidate.

### Highlights

- Four Evidence Dimensions: DECLARED, OBSERVED, CONNECTED, and RUNTIME remain distinct through reconciliation and presentation.
- RUNTIME V0 accepts explicit sanitized local JSONL lifecycle evidence without becoming monitoring or proof of authorization.
- The repository Woodcraft Workbench adds the local folder picker, Onboarding V1, bundled synthetic demo, guided tour, and dynamic demo CTA.
- Manifestless V1.1 lets an ordinary local project be inspected before adopting an optional owner declaration, with explicit `PRESENT` / `ABSENT` declaration context.
- Evidence, epistemic, CLI, SARIF, Technical Passport, packaging, and CI language now share the same bounded claim model.
- The npm artifact is deterministic and CLI-only; repository UI/lab assets are excluded.

### Known limits

- This is Alpha software. Scanner and workflow coverage are selective and incomplete.
- The npm artifact is CLI-only. Run the Woodcraft Workbench from a repository checkout.
- JSON (`taidyup.json`) is the supported declaration format. Real YAML parsing is not supported.
- CONNECTED n8n inspection is explicit opt-in and point-in-time, not monitoring.
- RUNTIME V0 requires explicit local evidence import and does not establish complete execution history.
- The OpenTelemetry composition lab is development validation only, not a supported ingestion path or collector.
- tAIdyup does not certify identity, authorization, safety, security, or compliance.

## GitHub About recommendations (manual owner action)

- Description: `Local-first evidence analysis for AI projects — know your AI while you build it.`
- Website: `https://www.npmjs.com/package/taidyup`
- Topics: `ai`, `ai-agents`, `developer-tools`, `local-first`, `sarif`, `security`, `governance`, `typescript`

Do not create the tag or GitHub Release until a separate publication GO.
