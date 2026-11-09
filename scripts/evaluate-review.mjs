import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { editorialSuites, editorialChecks } from './editorial-cases.mjs';
import { REVIEW_INSTRUCTIONS, reviewModelOptions, reviewSchema, validateReview } from '../lib/review.ts';

// Synthetic material only. Never load campaign documents in this evaluation.
try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!process.env.OPENAI_API_KEY) throw new Error('A server-side OPENAI_API_KEY is required.');
const baselineSource = execFileSync('git', ['show', '9487729:lib/review.ts'], { encoding: 'utf8' });
const baseline = { exports: {} };
new Function('require', 'exports', ts.transpileModule(baselineSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(createRequire(import.meta.url), baseline.exports);
const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 25_000, maxRetries: 0 });
const makeCues = (texts) => texts.map((text, i) => ({ id: String(i + 1), text }));
const developmentSuites = [
  { name: 'sentence-boundaries', cues: makeCues([
    'We opened the studio last spring,',
    'It now welcomes visitors every weekend.',
    'The centre offers practical training.',
    'Which helps participants find work.',
    'The centre offers practical training,',
    'which helps participants find work.',
    'We chose one activity:',
    'writing a short note each morning.',
    'My favorite color is green.',
    'She uses the Color Studio app.',
  ]) },
  { name: 'audio-uncertainty', cues: makeCues([
    'I was about to...',
    'then the door opened.',
    'For the next few weeks…',
    'we tried a different routine.',
    'Music, painting, movement...',
    'Each activity offers something different.',
    'At the end, we started again.',
  ]) },
  { name: 'preserve-voice-and-style', cues: makeCues([
    "I ain't changing my mind.",
    'You were right.',
    'But I needed time to see it.',
    'This year I began swimming.',
    'We keep a favourite notebook here.',
    '“Color” is the name printed on the product.',
    'The more we practised,',
    'the easier it became.',
  ]) },
];
const isEditorial = process.env.EVAL_SUITE === 'editorial';
const suites = (isEditorial ? editorialSuites : developmentSuites).filter((suite) => !process.env.EVAL_CASE || suite.name === process.env.EVAL_CASE);
if (!suites.length) throw new Error('EVAL_CASE did not match a suite.');
const currentModelOptions = process.env.EVAL_REASONING ? { reasoning: { effort: process.env.EVAL_REASONING } } : reviewModelOptions(model);
const suiteHash = createHash('sha256').update(JSON.stringify(suites)).digest('hex');
const implementationHash = createHash('sha256').update(await fs.readFile(new URL('../lib/review.ts', import.meta.url))).digest('hex');

function checks(suite, findings) {
  if (isEditorial) return editorialChecks(suite, findings);
  const edit = (id) => findings.flatMap((f) => f.kind === 'edit' ? f.cues : []).find((c) => c.cueId === id)?.proposedText;
  const touched = (ids) => findings.some((f) => f.cues.some((c) => ids.includes(c.cueId)));
  if (suite.name === 'sentence-boundaries') return {
    sentenceEnd: /spring[.!?]$/.test(edit('1') ?? ''),
    linkedContinuation: findings.some((f) => f.kind === 'edit' && f.cues.some((c) => c.cueId === '3' && /training[,;:]?$/.test(c.proposedText)) && f.cues.some((c) => c.cueId === '4' && /^which\b/.test(c.proposedText))),
    britishSpelling: /favourite colour/.test(edit('9') ?? ''),
    preservesCorrectContinuations: !touched(['5', '6', '7', '8']),
    preservesBrand: !touched(['10']),
  };
  if (suite.name === 'audio-uncertainty') return {
    flagsAllEllipses: ['1', '3', '5'].every((id) => findings.some((f) => f.kind === 'audio_check' && f.cues.some((c) => c.cueId === id))),
    doesNotAutomaticallyRemoveEllipses: !['1', '3', '5'].some((id) => edit(id)),
    preservesCleanSentence: !touched(['7']),
  };
  return { noUnnecessaryChanges: findings.length === 0 };
}

const results = [];
const outputPath = process.env.EVAL_OUTPUT || 'output/evals/review-comparison.json';
for (const suite of suites) {
  for (const version of (process.env.EVAL_CURRENT_ONLY ? ['current'] : ['baseline', 'current'])) {
    const started = Date.now();
    let raw;
    try {
      const response = await client.responses.parse({
        model, ...(version === 'current' ? currentModelOptions : { temperature: 0 }), store: false, max_output_tokens: 12_000,
        input: [{ role: 'system', content: version === 'current' ? REVIEW_INSTRUCTIONS : baseline.exports.REVIEW_INSTRUCTIONS }, { role: 'user', content: JSON.stringify({ cues: suite.cues }) }],
        text: { format: zodTextFormat(version === 'current' ? reviewSchema : baseline.exports.reviewSchema, 'subtitle_review') },
      });
      if (response.status !== 'completed' || !response.output_parsed) throw new Error(`Incomplete or unparsed response: ${response.status}`);
      raw = response.output_parsed;
      const findings = version === 'current' ? validateReview(raw, suite.cues).findings : raw.suggestions.filter((s) => baseline.exports.isSupportedReviewReference(s.referenceUrl, s.referenceEntry) && baseline.exports.hasEditorialChange(suite.cues.find((c) => c.id === s.cueId)?.text ?? '', s.proposedText)).map((s) => ({ kind: 'edit', cues: [{ cueId: s.cueId, proposedText: s.proposedText }], reason: s.reason }));
      const result = { suite: suite.name, version, elapsedMs: Date.now() - started, checks: checks(suite, findings), findings, raw, usage: response.usage };
      results.push(result);
      console.log(JSON.stringify({ suite: result.suite, version, elapsedMs: result.elapsedMs, checks: result.checks }));
    } catch (error) {
      const result = { suite: suite.name, version, elapsedMs: Date.now() - started, error: error.message, raw };
      results.push(result);
      console.log(JSON.stringify(result));
    }
    await fs.mkdir('output/evals', { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify({ model, currentModelOptions, date: new Date().toISOString(), baselineCommit: '9487729', suiteHash, implementationHash, note: 'Synthetic examples; one run per suite/version, not a production quality estimate. Frozen stage-two cases are still engineering expectations, not independent human validation.', suites, results }, null, 2));
  }
}
if (results.some((r) => r.version === 'current' && (r.error || Object.values(r.checks).some((passed) => !passed)))) process.exitCode = 1;
