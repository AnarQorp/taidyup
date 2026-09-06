# CONNECTED n8n V0

CONNECTED n8n is an explicit, local CLI/application/UI path for retrieving current workflow configuration. It is not used by `scan`, `validate`, or any default workflow; the local UI invokes it only after explicit opt-in.

## Boundary

- Requests: `GET /api/v1/workflows` and `GET /api/v1/workflows/{id}` only.
- Excluded: executions, credential endpoints, writes, activation, monitoring, subworkflow flattening, and RUNTIME.
- Authentication: API key resolved in memory from an environment variable. It is never accepted in the URL or emitted in results.
- Transport: HTTPS, except explicit loopback HTTP for disposable development; exact origin; no redirects; bounded time, response bytes, and pagination.
- Data: response allowlist before normalization; pinned, execution, static, and unknown top-level fields dropped; parameter and credential-reference values hashed by the existing workflow adapter.

## Evidence semantics

Every successful exact-workflow retrieval produces an immutable `POINT_IN_TIME`, `COMPLETE`, `SUCCESS` snapshot with source instance, workflow scope, revision when reported, response hash, and observation time. Draft `versionId` and `activeVersionId` remain separate. Neither implies execution.

Absence is derived only while comparing an explicitly selected local artifact or prior CONNECTED evidence with a successful, complete, identity-comparable current snapshot. Authentication failures, access denial, 404, rate limiting, timeouts, malformed responses, interrupted pagination, and source failures never produce absence.

`authorityMode` describes connector credential authority, not workflow authority. V0 can prove its own GET-only behavior (`CLIENT_ENFORCED_READ_ONLY`). A configured claim of `TECHNICALLY_READ_ONLY` remains `UNKNOWN` unless provider-verifiable permission evidence is available; CONNECTED V0 does not call a scope-discovery endpoint.

## Local-first

Network is off by default. `connected-n8n` is an explicit opt-in and discloses the provider, origin, endpoint classes, request method, authority mode, and absence of execution before retrieval. Analysis and reconciliation remain local; there is no tAIdyup cloud or telemetry dependency.
