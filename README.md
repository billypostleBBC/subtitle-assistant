# Subtitle proofing and conversion

BBC StoryWorks tool for importing timestamped Word transcripts, reviewing proposed text edits and audio questions, and exporting WebVTT. It preserves cue IDs, order and timings. It does not listen to audio, check the rendered video or grant editorial approval.

## Local setup

Use Node 22 or later and npm. The release checks were run with Node 24.19.0 and npm 11.17.0. The evaluation script is verified on Node 24.

```sh
npm ci
cp .env.example .env
# Set OPENAI_API_KEY in .env, then:
npm run dev
```

Open the local address printed by Next.js. `/review-demo` is a development-only demonstration with fixed invented content and no API calls. It returns 404 in a production build.

## Commands

- `npm test`: deterministic import, export, review validation and route tests.
- `npm run lint` and `npx tsc --noEmit`: static checks.
- `npm run build` and `npm start`: production Next.js build/server.
- `npx opennextjs-cloudflare build`: local Worker build; does not deploy.
- `npm run eval:review`: six paid requests comparing the original and current reviewer on synthetic development cases. Requires Git history containing `9487729`.
- `EVAL_SUITE=editorial EVAL_CURRENT_ONLY=1 EVAL_OUTPUT=output/evals/editorial.json npm run eval:review`: eight paid requests on the separate 130-cue synthetic suite. Results include input and implementation hashes. These are engineering checks, not human-QC accuracy estimates.

## Implementation and data

The React interface is in `components/subtitle-proofing-tool.tsx`. Review prompts and validation are in `lib/review.ts`; atomic decisions and export readiness are in `lib/review-state.ts`. Server routes handle import and proofing. Existing DOCX extraction happens in the browser; extracted text goes to the server. Standard timestamp layouts import deterministically. Unusual layouts use one OpenAI classification request. Proofing uses one OpenAI request, GPT-5.4 mini with medium reasoning by default, a 25-second timeout and no retries.

Only the server reads `OPENAI_API_KEY`. `OPENAI_MODEL` is an optional server override; other models have not been evaluated for this release. OpenAI calls set `store: false`; this is not a claim about the provider's wider retention policy. The app has no transcript database or file storage. Only the theme preference is saved in local storage. The existing feedback form is a separate third-party iframe and receives feedback entered there, not automatic transcript submissions.

Review limits: 800 cues, 4,000 characters per cue and 80,000 text characters in total. Import accepts up to 5,000 non-empty extracted lines. Caption export requires at most two 42-character lines per cue. Manual decisions and saved edits are held in browser memory and are lost on reload.

## Release

See `DEVELOPMENT.md` for the current stage and editorial evidence, `RELEASE_READINESS.md` for verification and unresolved risks, and `TOOL_HANDOFF.md` for the resolved hosting target and rollback procedure. Do not push to the tracked `main` branch without deployment approval. Frontend and API must be released together because version 0.2.0 changes the internal response from `suggestions` to `findings`.
