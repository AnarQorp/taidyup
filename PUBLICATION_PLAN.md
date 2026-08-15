# TAIDYUP PUBLIC ALPHA PUBLICATION PLAN

**Product Name:** `tAIdyup`  
**Technical Canonical Name:** `taidyup`  
**Target Version:** `v0.1.0-alpha.1`  
**Status:** `PREPUBLICATION_PREPARED` (Pending explicit human authorization)  
**Package Artifact SHA-256:** `6a8007b11ab83e8cdc5c8111f53723af92cc38082b850c43dab58886eda65f11`  

---

## 1. Publication Execution Steps (Human Release Checklist)

### Step A: Repository Creation
Create a public GitHub repository under the AnarQorp organization:  
`https://github.com/AnarQorp/taidyup`

### Step B: Clean Source Tree Push
Push the clean open-source source tree (verified 0 secrets, Apache-2.0 license, clean history).

### Step C: Git Tagging
Create signed release tag:
```bash
git tag -a v0.1.0-alpha.1 -m "tAIdyup Developer Alpha 1 Release"
git push origin v0.1.0-alpha.1
```

### Step D: GitHub Release & Release Asset Upload
Create GitHub Release `v0.1.0-alpha.1` titled **"tAIdyup Developer Alpha 1"** and attach the binary tarball: `taidyup-0.1.0-alpha.1.tgz`.

---

## 2. GitHub Discoverability & Topics
Configure the following topic tags on the GitHub repository:  
`ai-agents` • `ai-governance` • `agentic-ai` • `mcp` • `ai-security` • `developer-tools` • `sarif` • `open-source`

---

## 3. First External Test Invitation (AI Builders / Agencies)

> **Invitation Message:**
> 
> "Hey AI builders, freelancers, and agencies! 👋
> 
> We just released **tAIdyup Alpha 1** (`v0.1.0-alpha.1`), an open-source, local-first developer tool built to help you document what your AI agents are intended to do, compare declarations against observable code evidence, surface conflicts, and generate audit-ready **Technical Passports** for your clients.
> 
> **We want you to try to BREAK it.**
> 
> It's 100% local-first—no account required, no cloud connection, no source code upload.
> 
> ```bash
> npm install -g taidyup-0.1.0-alpha.1.tgz
> taidyup init
> taidyup validate
> taidyup report
> ```
> 
> Send us your false positives, false negatives, confusing outputs, or unsupported framework requests. We want raw developer feedback!
> 
> 🔗 Repository: https://github.com/AnarQorp/taidyup"

---

## 4. 7 Key External Feedback Questions
1. Did you understand what tAIdyup does within the first 2 minutes of reading the README?
2. Were you able to generate and review `taidyup.json` smoothly?
3. Were the validation outputs (`SUPPORTED`, `UNVERIFIED`, `CONFLICT`, `UNDECLARED`) clear and actionable?
4. Did tAIdyup surface any surprising capabilities or code bindings in your project?
5. Would you attach the generated `TECHNICAL_PASSPORT.md` to a client deliverable?
6. What is the single biggest missing feature before you would use this regularly?
7. Would you integrate `taidyup validate --strict` into your CI/CD pipeline?

---

## 5. Success Signals Measurement (Zero Telemetry)
Without telemetry, we measure community adoption via voluntary signals:
- GitHub issues tagged `false-positive` or `false-negative`.
- Pull requests adding new framework detectors.
- Technical Passports attached to client project deliveries.
- GitHub Actions CI workflow integrations.
