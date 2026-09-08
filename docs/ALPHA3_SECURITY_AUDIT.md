# Alpha 3 RC dependency security audit

Status: release-candidate evidence; run again immediately before publication.

## Before hardening

`npm audit` reported 12 development-tree findings: 2 low, 4 moderate, 5 high, and 1 critical. `npm audit --omit=dev` reported zero production findings because the CLI package has no production dependencies.

| Package/path | Exposure and relevance | RC action |
| --- | --- | --- |
| `tar` through `sqlite3 -> node-gyp` | DEV/local legacy backend install path; crafted archive extraction/processing findings included the critical result. Not in the npm CLI runtime. | Override to patched `tar >=7.5.21`; verify clean install/build/tests. |
| `cacache`, `make-fetch-happen`, `node-gyp`, `http-proxy-agent`, `@tootallnate/once` through `sqlite3` | DEV install/build chain for the repository's legacy SQLite backend. Not loaded by CLI or Woodcraft local UI. | Patched transitive `tar`; remaining old proxy chain is low severity. Removing SQLite or moving to sqlite3 6 requires backend/Node-runtime scope beyond this RC. |
| `vite` / nested `esbuild` | DEV server/build tooling for the repository UI. A remotely exposed dev server would increase relevance; supported UI binds its application bridge to loopback. | Update Vite to patched Node-18-compatible 6.4.3 and override esbuild to a patched compatible line; verify UI build/smoke. |
| `qs` through `express` / `body-parser` | Repository loopback local UI request parsing; no npm CLI exposure. | Update lockfile and override to patched 6.16.x; verify bridge tests. |

No `npm audit fix --force` was used. The direct `sqlite3` 6 remediation requires Node >=20.17 and is not a bounded Alpha 3 change because the package contract remains Node >=18.

## After hardening

- `npm audit --omit=dev`: 0 vulnerabilities.
- Full `npm audit`: 5 low, 0 moderate, 0 high, 0 critical.
- Remaining paths: `sqlite3 -> node-gyp -> make-fetch-happen -> http-proxy-agent -> @tootallnate/once` in the repository development/install tree.
- The critical `tar`, high `vite`, moderate `esbuild`/`qs`, and their aggregate findings are resolved by the bounded updates above.

## Release relevance

- Published npm artifact: CLI-only, zero production dependencies, and no SQLite, Express, Vite, OTel, UI, test, or lab files.
- Repository UI: local development surface only; must remain loopback-bound and must not expose the Vite development server as a public service.
- Remaining low findings, if still reported, belong to the obsolete SQLite/node-gyp installation chain and are accepted only as a documented development limitation for this RC. Any remaining high or critical result blocks publication pending reassessment.
