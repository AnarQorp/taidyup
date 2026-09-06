# OpenTelemetry → RUNTIME V0 validation lab

Status: **validation fixture only**. This is not a supported generic OpenTelemetry ingestion path, receiver, monitor, or automatic instrumentation feature.

The primary success scenario uses the official OpenTelemetry JavaScript SDK with `InMemorySpanExporter` and `SimpleSpanProcessor`, then passes the captured span through a strict local envelope adapter into the existing RUNTIME V0 JSONL contract. Adversarial edge cases use deterministic span envelopes so malformed and incomplete telemetry can be exercised precisely. The lab opens no socket, exports nothing remotely, and runs only when the dedicated test explicitly invokes it.

The SDK packages are development-only dependencies: `@opentelemetry/api@1.9.1` and `@opentelemetry/sdk-trace-base@2.11.0`. No production dependency or supported product ingestion surface is added.

## Mapping

| OTel fact | RUNTIME V0 fact | Limitation |
| --- | --- | --- |
| span with `startTime` | `EXECUTION_STARTED` | Does not establish `INVOCATION_ATTEMPTED`, identity, authority, or success. |
| ended span, status `OK` | `EXECUTION_COMPLETED` / `SUCCEEDED` | Source-reported status only; not result correctness or downstream effect. |
| ended span, status `ERROR` | `EXECUTION_COMPLETED` / `FAILED` | Does not make the capability unsupported. |
| ended span, status `UNSET` | `EXECUTION_COMPLETED` / `UNKNOWN` | No success inference. |
| span without `endTime` | start only | Completion is not synthesized. |
| trace/span/parent identifiers | correlation and event identity | Never subject identity, authority, ownership, or binding. |

Effective completeness remains `PARTIAL_OBSERVATION`: a trace cannot prove complete instrumentation, delivery, participation, or absence of executions outside the trace. `service.name`, span name, run identifiers, and tool/action names do not bind a subject. A `BOUND` subject is possible only through a separate inspectable binding supplied by the existing tAIdyup context.

The adapter strictly validates the envelope, selects only `taidyup.operation.action` and optional `taidyup.resource.classification`, and drops all other attributes as one non-sensitive category. Prompts, outputs, arguments, results, tokens, headers, email addresses, bodies, queries, exceptions, and arbitrary attributes are never copied into RUNTIME evidence.

This lab validates composition with the existing model. It does not change Evidence types, authority states, the Trust Kernel, `runtimeAssessment`, GUI/reports, completeness, package version, or production dependencies.
