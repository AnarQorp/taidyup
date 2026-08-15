---
name: Detection Feedback
about: Report a false positive, false negative, incorrect capability, or unexpected epistemic state
title: '[DETECTION] '
labels: 'detection'
assignees: ''
---

> ⚠️ **SECURITY REMINDER:** Do NOT paste secrets, API keys, credentials, proprietary source code, or sensitive client data into public issues.

### Feedback Type
Select all that apply:
- [ ] False Positive (tAIdyup inferred authority that does not exist in code)
- [ ] False Negative (tAIdyup missed a capability or tool present in code)
- [ ] Incorrect Capability / Action (e.g., EXECUTE vs READ vs SEND)
- [ ] Incorrect Agent / Framework Association
- [ ] Incorrect Provenance / File Line
- [ ] Unexpected Epistemic State (`SUPPORTED`, `UNVERIFIED`, `CONFLICT`, `UNDECLARED_OBSERVATION`, `UNKNOWN`)

### Environment & Framework
- **tAIdyup Version:** `taidyup --version`
- **AI Framework / Ecosystem:** (e.g., LangChain, LangGraph, CrewAI, AutoGen, LlamaIndex, Semantic Kernel, MCP, Custom)
- **Programming Language:** (TypeScript / JavaScript, Python)

### What tAIdyup Detected
```text
(Paste relevant output line from `taidyup scan` or `taidyup validate`)
```

### What You Expected
Explain what capability or state you expected tAIdyup to observe.

### Minimal Sanitized Code Example
```typescript
// Minimal sanitized code snippet reproducing the detection behavior.
// DO NOT upload full proprietary repositories or client code.
```
