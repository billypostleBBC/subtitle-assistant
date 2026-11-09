# Release readiness: Subtitle proofing and conversion 0.2.0

Date: 9 November 2026. Reviewer: Codex. Candidate: version 0.2.0 from baseline `9487729`. This assessment is recorded immediately before the authorised release; see the local `output/deployment/latest.json` receipt for resulting commit, deployment and verification.

## Current state

Locally verified, with dependency findings recorded below. Billy instructed “deploy” after being asked to approve this candidate with those documented build-tool risks. Release to the existing `/subtitle-assistant` environment is authorised. This does not establish human-QC equivalence or remove the recorded limitations.

## Evidence

| Gate | Command or check | Result |
| --- | --- | --- |
| Clean npm install | `npm ci --no-audit` | Passed, Node 24.19.0/npm 11.17.0; lifecycle-script warnings recorded |
| Lint | `npm run lint` | Passed |
| Type-check | `npx tsc --noEmit` | Passed |
| Unit/integration tests | `npm test` | 94 passed across eight files |
| Production build | `npm run build` | Passed, Next.js 16.4.5 |
| Worker build | `npx opennextjs-cloudflare build` | Passed; initial skip-build attempt lacked standalone output and was replaced by a full adapter build |
| Editorial cases | Eight suites, 130 invented cues | Passed with medium reasoning; final run 1.5–6.7 seconds per request |
| Development regression | Three suites, nine assertions | 9/9 passed after the stage-two changes |
| Browser and accessibility | Import, review/retry, editing, export, 390px, keyboard/focus/reduced motion | Repeated successfully after dependency updates; real synthetic model request exercised through the production Next.js server |
| Local Worker runtime | Wrangler local preview | Root HTTP 200, deterministic text import 200 with original timing/text, demo route 404; live mounted environment remains untested |
| Data/privacy | Source review and unit checks | No client files sent; no transcript storage; generic import errors; server-side key |
| Dependency audit | `npm audit --json` | 13 findings remain: five high, eight moderate, zero critical |
| Mounted deployment | Plugin read-only inspection | Existing app/environment/mount resolved; no write, deployment or live test |

Evidence files are local in `output/evals/` and `output/playwright/`, excluded from Git. Frozen source cases and scoring are in `scripts/editorial-cases.mjs`. The final editorial report includes SHA-256 identifiers for the case set and reviewer source. The eight fresh cases passed before and after the small deterministic validation changes. The original low-reasoning 70-cue run failed validation because it included unchanged replacements; retained evidence records that failure. Acceptance checks were not weakened.

Browser downloads were read back after the final run: saved text and original cue IDs/timings were preserved, and cancelled drafts were absent. The console contained the deliberately simulated 429, an existing missing favicon 404 and the existing feedback iframe's IndexedDB warning; no application exception was observed. Framework-generated `AGENTS.md` and `next-env.d.ts` changes accompany the Next.js update.

## Unresolved findings

- **Dependency advisories:** non-breaking lockfile updates reduced the original 30 findings (including two critical) to 13. Remaining findings follow `glob`/`minimatch`/`brace-expansion` through the OpenNext build tool and ESLint. These process project files during build/lint; no transcript route calls them. This is a source-path assessment, not proof of universal non-exploitability. The proposed forced fix downgrades OpenNext to 0.3.0 and was deliberately not applied. Restrict builds to trusted source. Billy authorised release with these documented risks on 9 November 2026; continue to track upstream fixes.
- **Editorial scope:** model-supported text assistance, not full audiovisual QC. These are engineering-authored synthetic cases, not a blinded production benchmark. Case expectations include 11 cue corrections, a linked pair, three audio questions and preservation of correct text. No actual campaign audio/video or client transcript was sent for live review.
- **Reference scope:** subtitle section labels are allowlisted; general News Style Guide entry labels are model-selected. A link is not independent verification of an entry or its applicability.
- **Platform:** actual mounted success/failure paths, runtime limits, deployment account configuration and access restrictions still require authorised platform verification. No 800-cue live model/load test was run.

## Release proposal

Release the reviewed source and updated lockfile together to the existing `main` environment at `/subtitle-assistant`, as authorised. Verify the mounted tool with invented content and keep final human video QC in the operational workflow. The plugin confirmed the previous deployment's commit is `94877296711c1d8da60fcfd33f3dea495fb7be75`; preserve it as the rollback target. Live browser testing has been requested separately because the earlier browser approval covered localhost only.
