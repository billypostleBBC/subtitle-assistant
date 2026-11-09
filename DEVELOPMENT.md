# Subtitle review development loop

## Outcome and scope

Improve the text review so it recognises sentences across subtitle cues, presents dependent edits together and flags questions that require audio. Preserve cue IDs, timings, source wording unless approved, DOCX import, caption layout limits, WebVTT export and the existing visual design. One review action remains one model request.

The reported comparison contains seven passages with punctuation/case differences across ten cues. The human file is not unquestioned ground truth: its cue 10 retains a comma after an inserted full stop, and several edits are optional or require audio. Client files stay local; live API evaluation uses invented material only.

No video/audio processing, retiming, new infrastructure or model migration is included. Deployment was separately authorised on 9 November 2026 after the release checkpoint.

## Acceptance and evidence

- Review the supplied sequence for sentence continuity without merging or splitting subtitle cues.
- Resolve dependent punctuation/case edits as one item; approve, reject or save all edited cues together.
- Show actionable audio checks with adjacent context and a keep/edit decision. Unresolved checks and unsaved edits prevent export.
- Preserve source cue IDs/order/timings in all exported results.
- Validate model output and the client response. Unknown IDs, overlaps, invalid references, refusals, incomplete results and service failures must not produce a clean-review state.
- Review existing ellipses explicitly; never remove them automatically without audio confirmation.
- Retain current import/export tests; add deterministic red-green tests for review validation, resolution and export readiness, plus route failures.
- Run lint, type checking, a production build, live synthetic editorial evaluations and local browser checks of success/failure, keyboard use and narrow layout.
- Distinguish passing software checks from editorial accuracy; report false positives and remaining uncertainty.

## Stages and review stops

1. **Working local review journey (authorised now).** Implement and verify the core flow, supply a usable local preview and evidence. Stop for Billy to judge linked edits, audio-check wording and the interaction. Synthetic model evaluation accompanies this checkpoint; it is not a claim of production QC equivalence.
2. **Editorial validation and release candidate (after checkpoint feedback).** Refine the reviewed behaviour and broaden benchmark coverage. Confirm any permission needed before sending real client material to an API. Prepare the verified change and a concrete deployment proposal, then stop again.
3. **Deployment (only on explicit instruction).** Use the approved Webflow workflow and verify the live result.

## Decisions and limits

Routine reversible implementation, tests and local preview are authorised. Local browser automation was explicitly approved on 9 November 2026. Keep API keys server-side, request storage disabled, request time/output bounded and retries explicit. No model change or additional infrastructure without a demonstrated need. No user-specified usage budget.

## Progress

- 9 November 2026: inspected clean worktree at `9487729`; existing review is a flat suggestion list with no audio-check state or linked resolution. Existing tests check schema/helpers, not editorial detection. Stage 1 in progress.
- Stage 1 implementation is ready for review locally at `http://127.0.0.1:3035/review-demo`. This is explicitly labelled fixed synthetic data, exercises the real review interface and makes no model requests. The normal tool is at `http://127.0.0.1:3035/`.
- Added grouped edit/audio-check findings, atomic decisions, neighbouring context, punctuation highlighting, client/server validation and an ellipsis safety check. Invalid results now fail visibly in full. The model request has no automatic retries, a 25-second timeout, a 12,000-token output limit and storage disabled. Input remains capped at 800 cues, with an additional 80,000-character total limit.
- First live evaluations failed: the model returned unchanged context as edits, copied neighbouring cue text, cited unsupported section labels and over-edited correct text. These results were rejected rather than silently discarded. Explicit examples, exact citation labels, schema descriptions and low reasoning effort on the same GPT-5.4 mini model produced two consecutive successful runs of the targeted checks. No model migration was made. Other model overrides retain their previous sampling settings and have not been evaluated.

## Checkpoint evidence

- **Automated tests:** 88 passed across 8 files. Red failures were observed before implementing validation, grouped resolution, punctuation highlighting and route error handling. Existing import and subtitle tests remain in the suite.
- **Static/build checks:** lint, TypeScript checking, production build and `git diff --check` passed. The demo route returns HTTP 404 under the production server.
- **Browser:** real DOCX import, a real synthetic API review, retry after a simulated 429, rejection of a malformed success response, linked approval/rejection/editing, audio keep/edit decisions, blank and unsaved edit blocking, draft cancellation, export and re-review of saved text all passed. Downloaded VTT files were read back: source IDs/timings/order and the selected text were preserved.
- **Accessibility/layout:** keyboard activation, focus after resolving an item, reduced-motion behaviour and a 390px layout without horizontal overflow were checked. Light and dark layouts were visually inspected. The existing feedback iframe emitted an IndexedDB warning; the intentional 429 test and missing development favicon produced expected console errors, with no observed application exception.
- **Live editorial evaluation:** 25 invented cues in three suites, with nine targeted assertions. Previous implementation: 5/9. Final implementation: 9/9, repeated successfully. Baseline scoring includes its real filtering behaviour, so unchanged or unsupported suggestions that the old endpoint discards do not count as displayed changes. Final comparison response times were 2.0–2.7 seconds for the baseline and 2.2–8.4 seconds for the new version. These small samples are not a production accuracy or latency estimate.
- Reproduce deterministic checks with `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. Reproduce synthetic API evaluation with `npm run eval:review` using Node 24 (tested), the local server key and Git history containing `9487729`. This makes six paid model requests; no client documents are loaded. Latest evidence is `output/evals/review-final-comparison.json`; the preceding successful run is `output/evals/review-schema-guidance.json`.
- Browser evidence and downloaded VTTs are in `output/playwright/`. These local verification artifacts are ignored by Git. Screenshots `linked-edit.png` and `audio-check.png` show the new controls. No source client documents were copied into the repository or sent to the API.

## Review judgement and next stage

Billy approved the first checkpoint on 9 November 2026: “yeah i think this works well”. Stage 2 completed as a local release-review candidate with the approved interface preserved. Billy then instructed “deploy” in response to the concrete release proposal and its documented remaining build-tool risks. Stage 3 is authorised: commit and push the verified source to the existing tracked `main` environment, monitor the deployment and verify it within the permitted tools. The deployment receipt is recorded locally in `output/deployment/latest.json` after the operation; do not infer live status from this pre-deployment record.

Remaining limitations: no review against actual campaign audio/video or live evaluation of confidential material; a 70-cue synthetic model test passed, but there was no 800-cue model/load test or actual mounted Webflow Cloud verification. News Style Guide entries remain model-selected rather than retrieved and verified. Strict validation can reject an entire review when one finding is malformed, requiring a retry. Engineering-authored synthetic cases do not establish human-QC equivalence; final human video review remains necessary.

Version is now 0.2.0. The internal review response changes from flat `suggestions` to grouped `findings`. Frontend and API must be released together and existing sessions refreshed. The Webflow plugin confirmed the previous successful deployment `6b8f9185-13d3-40bb-b242-964fe20fc60d` serves commit `94877296711c1d8da60fcfd33f3dea495fb7be75`; this is the verified rollback target. No stored-data migration is required. This record is prepared before the authorised release; the receipt records the resulting commit/deployment and verification.

## Stage 2 evidence and decisions

- Fresh cases were written and frozen before testing: eight suites with 130 invented cues, including a 70-cue narrative. They check 11 cue corrections, one linked pair, three ellipsis/audio decisions, correct continuations, dialect, names, numbers, labels, Unicode and transcript text that resembles an instruction. No original client material was used in API requests.
- The first run passed seven suites but rejected the 70-cue result because the model repeated two already-correct cues as replacements. Validation remained strict. A pilot and a complete eight-suite run passed with **medium reasoning on the same GPT-5.4 mini model**. That is now the default; no second model request or automatic retry was added. The final run also passed all eight suites (1.5–6.7 seconds/request, 22,583 total tokens). The original nine development assertions passed again. Cases were not weakened to obtain a pass.
- Added deterministic coverage of input boundaries (800 cues, 80,000 total characters, 4,000 per cue and trimmed-ID collisions). Audio checks now include an unassigned cue following an ellipsis so the reviewer can edit its capitalisation; repeated client/server validation is stable and overlapping findings remain forbidden. Blank reference titles are rejected. Import errors no longer log raw provider exceptions.
- Non-breaking dependency updates through the existing declared ranges addressed the audit's two critical findings and reduced total reported findings from 30 to 13. Next.js is now 16.4.5, OpenNext 1.20.16 and Zod 4.6.7 in the lockfile. The remaining five high/eight moderate findings follow build/lint dependencies and are documented for release judgement. No forced downgrade or new dependency was introduced. Node 22+ is declared; checks used 24.19.0.
- Clean install, **94 tests**, lint, type checking, production Next.js build and full OpenNext Worker build passed. Local Worker smoke checks returned 200 for the root and deterministic import and 404 for the demo. The initial `--skipNextBuild` adapter attempt lacked standalone output; the full adapter build succeeded without changing hosting configuration.
- Repeated mobile, keyboard/focus, reduced-motion, grouped-decision and draft-cancellation browser checks after the dependency update. The production Next.js browser journey passed actual synthetic review/import/export, malformed response, 429/retry, editing and re-review. Read downloaded VTT files back and confirmed saved text and source IDs/timings/order.
- The Webflow plugin confirmed the existing app tracks `billypostleBBC/subtitle-assistant` on `main`, mounted at `/subtitle-assistant`. No platform write was made. Record the currently deployed commit before any eventual release; `9487729` is only the known local source baseline, not a verified live rollback commit.
- Release records: `README.md`, `TOOL_HANDOFF.md`, `RELEASE_READINESS.md`. Raw local evidence: `output/evals/review-editorial-first.json`, `review-editorial-medium.json`, `review-editorial-final.json`, `review-regression-final.json`, `dependency-audit-final.json`, `production-build.log`, `cloud-build.log`; browser evidence remains under `output/playwright/`.
