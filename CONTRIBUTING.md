# Contributing to tAIdyup

Thank you for your interest in contributing to tAIdyup!

tAIdyup is an open-source, local-first developer tool designed to bring evidence-backed technical governance to AI builders.

---

## 🛡️ The Fundamental Rule of Contribution

When writing code or framework detectors for tAIdyup, you must follow the fundamental rule:

> **Evidence over Inference. Trust Nothing. Prove Everything.**

- Never infer dynamic capabilities without observable code evidence.
- If a capability cannot be deterministically observed in code, return `UNKNOWN` or `UNVERIFIED`.
- Never claim legal compliance certification or legal status automatic assignment.

---

## 🔒 Security & Privacy Guidelines

> ⚠️ **DO NOT post secrets, API keys, credentials, proprietary source code, or private client data into public GitHub issues, PRs, or discussions.**

When submitting detection feedback or false positive reports:
- Always use minimal, sanitized code snippets (e.g. 5–10 lines showing only the relevant framework import or tool instantiation).
- Replace proprietary variable names, database URLs, and API endpoints with placeholders (e.g., `resource: "postgres:invoices"`).

---

## 🔍 Reporting Detection Feedback

We welcome feedback from developers running tAIdyup on real-world AI projects:
- **False Positives / Missed Capabilities:** Use the [Detection Feedback template](https://github.com/AnarQorp/taidyup/issues/new?template=detection_feedback.md).
- **Bug Reports:** Use the [Bug Report template](https://github.com/AnarQorp/taidyup/issues/new?template=bug_report.md).
- **Framework Support Requests:** Use the [Framework Request template](https://github.com/AnarQorp/taidyup/issues/new?template=framework_request.md).

---

## 🛠️ Local Development & Testing Setup

```bash
git clone https://github.com/AnarQorp/taidyup.git
cd taidyup
npm install
npm test
npm run build
```

Before submitting a Pull Request, ensure:
1. All adversarial reconciliation tests pass (`npm test`).
2. Production build compiles cleanly (`npm run build`).
3. Automated safety language check passes (`npx tsx tests/oss_safety_language_check.test.ts`).

---

## 📜 Framework Detector Contribution Guide

To add support for a new AI framework (e.g. Haystack, DSPy, Vercel AI SDK, custom MCP servers):

1. Read the framework detector specification: [docs/DETECTOR_API.md](docs/DETECTOR_API.md).
2. Add your detector logic to `src/scanner/scannerCore.ts`.
3. Add minimal test fixtures under `tests/benchmark_corpus/`.
4. Ensure 100% of existing tests pass (`npm test`).

---

## ⚖️ License

By contributing to tAIdyup, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
