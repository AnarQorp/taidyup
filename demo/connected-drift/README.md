# Synthetic CONNECTED drift demo

This is synthetic demo/test data. It does not execute an n8n workflow, send email, contact a third party, or contain a real credential. The local provider implements only the two GET routes used by CONNECTED n8n V0; all other methods fail with `405`.

## Start

From the repository root, install dependencies once and build:

```bash
npm ci
npm run build
```

Terminal 1 — start the disposable n8n-compatible source in T1:

```bash
npx tsx demo/connected-drift/provider.ts
```

Terminal 2 — start the real tAIdyup local UI bridge with the synthetic token in its process environment:

```bash
TAIDYUP_DEMO_N8N_TOKEN=synthetic-demo-token npm run ui
```

Open <http://127.0.0.1:3001>. Use these values:

| Field | Value |
| --- | --- |
| Local project directory | absolute path to `demo/connected-drift/project` |
| n8n base URL | `http://127.0.0.1:5679` |
| Workflow ID | `wf-1` |
| Connection ID | `synthetic-demo` |
| Token environment variable | `TAIDYUP_DEMO_N8N_TOKEN` |
| Authority mode | `CLIENT_ENFORCED_READ_ONLY` |
| Observed workflow artifact | absolute path to `demo/connected-drift/workflow-t1.json` |
| Loopback HTTP | checked |

Click **Inspect current configuration**. T1 should show `SEND` as `SUPPORTED`, with DECLARED, OBSERVED, and CONNECTED evidence; RUNTIME remains unavailable. Open **Why?** on SEND to inspect the evidence and provenance.

## Change to T2

In Terminal 1, type:

```text
t2
```

Click **Inspect current configuration** again without changing the form. SEND should become `UNVERIFIED`; the UI should show `CURRENT_STATE_DRIFT`, an accepted scoped `ABSENCE_OBSERVED`, and “Current connected configuration changed.”

This demonstrates a change in source-reported configured authority between comparable point-in-time snapshots. It does not establish execution, credential validity, authorization, permission revocation, safety, or compliance. The bridge retains T1 only in memory while it remains running; restarting it resets the comparison.
