# Tool handoff: Subtitle proofing and conversion

## Purpose and source

- Product/design owner: Billy Postle, BBC StoryWorks.
- Users: staff preparing campaign subtitles.
- Source: existing public `billypostleBBC/subtitle-assistant` repository. Baseline source remains in Git at `9487729`; version 0.2.0 is authorised for release. Final release evidence is recorded in the local `output/deployment/latest.json` receipt.
- Preserved behaviour: Word import, original cue IDs/timings/order, human decisions, caption layout limits and WebVTT export.

## Architecture

Existing Next.js/React application retained. Lockfile now resolves Next.js 16.4.5 and OpenNext Cloudflare 1.20.16. No new service, storage, queue or authentication system. Node requirement is declared as 22+; local checks used 24.19.0. The project root is the build root and `webflow.json` declares `nextjs`.

DOCX extraction runs in the browser; text import and review run through server routes. Standard imports are deterministic, unusual ones use OpenAI. Review is one bounded OpenAI request. No transcript persistence is implemented. Import error logs now record only a generic failure; review errors do not log provider payloads. There is no app-level authentication or rate limiting. Existing host access restrictions were not independently verified in this stage.

## Local use and environment

```sh
npm ci
npm run dev
```

Configure secrets locally from `.env.example`; never commit `.env`.

| Name | Purpose | Secret? | Required in |
| --- | --- | --- | --- |
| OPENAI_API_KEY | Server-side OpenAI authentication | Yes | Live proofing and AI import fallback |
| OPENAI_MODEL | Optional model override; default GPT-5.4 mini | No, but server-only | Optional |

Both OpenAI routes request `store: false`. Provider retention/residency is not independently established by that flag. See README for input limits and data flow. No client campaign files were sent during this work.

## Resolved Webflow target

Read through the installed Webflow plugin on 9 November 2026:

- Site: StoryWorks Creative Resources (`665dc71c93e6f704f2ab8734`).
- App: `subtitle-assistant` (`0ee0ed30-91df-4261-b393-99aa0eb6b2c3`).
- Source: `https://github.com/billypostleBBC/subtitle-assistant`.
- Environment: `5430055a-df62-4909-b5eb-36b778d8ccf5`, tracking `main`.
- Mount: `/subtitle-assistant`.
- Environment URL: `https://storyworkscreativeresources.webflow.io/subtitle-assistant`.
- Before release, the plugin confirmed the successful deployment `6b8f9185-13d3-40bb-b242-964fe20fc60d` finished on 11 September 2026 and used commit `94877296711c1d8da60fcfd33f3dea495fb7be75`.

The user authorised deployment on 9 November 2026. The client computes its API prefix from the current mounted path. Webflow controls framework mount settings at build time; no production base-path configuration change is required.

## Proposed release and rollback

After explicit deployment approval and resolution/acceptance of the readiness findings, commit the reviewed source and lockfile together, then update the existing tracked `main` branch. That push is a deployment action. Deploy frontend and API together, refresh old browser sessions, and verify import, review, linked/audio decisions, export, assets and direct reload at the actual mounted URL using invented text.

For rollback, restore the paired frontend/API release at verified prior commit `94877296711c1d8da60fcfd33f3dea495fb7be75` via the approved deployment workflow and repeat mounted checks. No stored-data migration is needed.

## Limits and ownership

Audio/video QC and editorial approval remain human responsibilities. Synthetic tests cannot establish production recall. Model-selected News Style Guide entry labels have not been independently verified. 800-cue input validation is tested; model performance at that size is not. The exact mounted runtime, access restrictions and account usage limits remain staging/live verification tasks. Existing BBC Reith font assets and feedback integration are preserved; no new third-party assets were added. Engineering release ownership remains with the repository owner.
