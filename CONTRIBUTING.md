# Contributing to tAIdyup

Thank you for your interest in contributing to tAIdyup!

tAIdyup is an open-source, local-first developer tool designed to bring evidence-backed technical governance to AI builders.

---

## 🛡️ The Fundamental Rule of Contribution

When writing plugins or framework detectors for tAIdyup, you must follow the fundamental rule:

> **Evidence over Inference. Trust Nothing. Prove Everything.**

- Never infer dynamic capabilities without observable code evidence.
- If a capability cannot be deterministically observed in code, return `UNKNOWN` or `UNVERIFIED`.
- Never claim legal compliance certification or legal status automatic assignment.

---

## 🛠️ Local Development Setup

```bash
git clone https://github.com/AnarQorp/taidyup.git
cd taidyup
npm install
npm run build
npm test
```

---

## 📜 Framework Detector Contribution Guide

To add support for a new AI framework (e.g. AutoGen, Semantic Kernel, n8n, custom MCP servers):

1. Read the framework detector specification: [docs/DETECTOR_API.md](docs/DETECTOR_API.md).
2. Add your detector logic to `src/scanner/detectors/`.
3. Add realistic code samples and integration test fixtures to `benchmarks/fixtures/`.
4. Ensure 100% of existing adversarial reconciliation tests pass (`npm test`).

---

## ⚖️ License

By contributing to tAIdyup, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
