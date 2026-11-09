"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { referenceLabelFor, referenceUrlFor, validateReview, type ReviewFinding } from "../lib/review";
import { changedProposedSegments } from "../lib/proposed-changes";
import { extractTranscriptLines } from "../lib/docx";
import type { IgnoredImportLine, SubtitleImportResult } from "../lib/import";
import { findOverlongCues, formatCueText, MAX_CAPTION_LINE_LENGTH, SubtitleCue, SubtitleFormatError, toWebVtt } from "../lib/subtitles";

import { applyReviewDecisions, canExportReview, isFindingResolved, type DirectCueEdit, type FindingState, type Resolution } from "../lib/review-state";

type InitialReview = { cues: SubtitleCue[]; findings: ReviewFinding[] };

const noiseCategoryLabels: Record<IgnoredImportLine["category"], string> = {
  cue_number: "Cue number",
  heading: "Heading",
  production_note: "Production note",
  other: "Other formatting",
};

function ProposedText({ original, proposed }: { original: string; proposed: string }) {
  return <>{changedProposedSegments(original, proposed).map((segment, index) => segment.changed ? <mark key={index}>{segment.text}</mark> : segment.text)}</>;
}

function CaptionLayout({ text, lineCount }: { text: string; lineCount: number }) {
  const lines = formatCueText(text).split("\n");
  return <div className="caption-layout" role="status">
    <p><strong>Caption layout needs attention:</strong> {lineCount} lines; maximum 2. Edit and save the final text here to resolve it. Re-upload only if the timing also needs changing.</p>
    <div className="caption-lines" aria-label={`Caption line lengths, maximum ${MAX_CAPTION_LINE_LENGTH} characters per line`}>
      {lines.map((line, index) => <div className="caption-line" key={`${index}-${line}`}><span>{line}</span><output>{line.length} / {MAX_CAPTION_LINE_LENGTH}</output></div>)}
    </div>
  </div>;
}

export function SubtitleProofingTool({ initialReview, demonstration = false }: { initialReview?: InitialReview; demonstration?: boolean }) {
  const [cues, setCues] = useState<SubtitleCue[]>(initialReview?.cues ?? []);
  const [findings, setFindings] = useState<FindingState[]>(initialReview?.findings ?? []);
  const [hasCompletedReview, setHasCompletedReview] = useState(Boolean(initialReview));
  const progressRef = useRef<HTMLDivElement>(null);
  const [fileBaseName, setFileBaseName] = useState("subtitles");
  const [error, setError] = useState("");
  const [ignoredImportLines, setIgnoredImportLines] = useState<IgnoredImportLine[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showRemainingOnly, setShowRemainingOnly] = useState(true);
  const [directCueEdits, setDirectCueEdits] = useState<Record<string, DirectCueEdit>>({});

  const resolvedCues = useMemo(() => applyReviewDecisions(cues, findings, directCueEdits), [cues, findings, directCueEdits]);
  const overlongCues = useMemo(() => findOverlongCues(resolvedCues), [resolvedCues]);
  const overlongCueIds = new Set(overlongCues.map((cue) => cue.cueId));
  const unresolved = findings.filter((finding) => !isFindingResolved(finding)).length;
  const editCount = findings.filter((finding) => finding.kind === "edit").length;
  const checkCount = findings.length - editCount;
  const resolved = findings.length - unresolved;
  const visibleFindings = findings.map((finding, index) => ({ finding, index }))
    .filter(({ finding }) => !showRemainingOnly || !isFindingResolved(finding) || finding.cues.some((cue) => overlongCueIds.has(cue.cueId)));
  const layoutOnlyCues = overlongCues
    .filter((issue) => !findings.some((finding) => finding.cues.some((cue) => cue.cueId === issue.cueId)))
    .map((issue) => ({ issue, cue: resolvedCues.find((cue) => cue.id === issue.cueId)! }));
  const hasOpenEditor = findings.some((finding) => finding.isEditing) || Object.values(directCueEdits).some((edit) => edit.isEditing);
  const exportReady = canExportReview(hasCompletedReview, findings, directCueEdits, overlongCues.length) && !isReviewing && !isImporting;
  const activeStep = !cues.length ? 1 : exportReady ? 3 : 2;

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    if (savedTheme !== "light" && savedTheme !== "dark") return;
    document.documentElement.dataset.theme = savedTheme;
  }, []);

  function toggleTheme() {
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const currentIsDark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : systemIsDark;
    const nextTheme = currentIsDark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("theme", nextTheme);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setCues([]);
    setIgnoredImportLines([]);
    setFindings([]);
    setDirectCueEdits({});
    setHasCompletedReview(false);
    setShowRemainingOnly(true);
    setIsImporting(true);
    try {
      if (!file.name.toLowerCase().endsWith(".docx")) throw new SubtitleFormatError("Upload a .docx document.");
      let lines;
      try {
        lines = await extractTranscriptLines(await file.arrayBuffer());
      } catch {
        throw new SubtitleFormatError("The Word document could not be read. Check that it is a valid .docx file and try again.");
      }
      if (!lines.length) throw new SubtitleFormatError("The Word document does not contain any text.");

      const appPath = window.location.pathname.replace(/\/$/, "");
      const response = await fetch(`${appPath}/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const responseText = await response.text();
      let payload: (Partial<SubtitleImportResult> & { error?: string });
      try {
        payload = JSON.parse(responseText) as Partial<SubtitleImportResult> & { error?: string };
      } catch {
        if (response.status === 504) {
          throw new Error("The transcript import took too long and Webflow Cloud ended the request. Try again; if it continues, report the source file so its layout can be supported directly.");
        }
        throw new Error(
          `The transcript import service returned ${response.status} ${response.statusText || "response"}, not JSON. Check the Webflow Cloud deployment and mount path.`,
        );
      }
      if (!response.ok || !Array.isArray(payload.cues) || !Array.isArray(payload.ignoredLines)) {
        throw new Error(payload.error || "The transcript import service could not interpret this document.");
      }

      setCues(payload.cues);
      setIgnoredImportLines(payload.ignoredLines);
      setFileBaseName(file.name.replace(/\.docx$/i, "") || "subtitles");
    } catch (cause) {
      setCues([]);
      setError(cause instanceof Error ? cause.message : "The document could not be read.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  async function requestReview() {
    if (isReviewing || isImporting || hasOpenEditor) return;
    setError("");
    setHasCompletedReview(false);
    setIsReviewing(true);
    const sourceCues = resolvedCues;
    try {
      const appPath = window.location.pathname.replace(/\/$/, "");
      const response = await fetch(`${appPath}/api/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cues: sourceCues.map(({ id, text }) => ({ id, text })) }),
        signal: AbortSignal.timeout(30_000),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Proofing could not be completed. Please try again.";
        throw new Error(message);
      }
      let review;
      try {
        review = validateReview(payload, sourceCues);
      } catch {
        throw new Error("The review response could not be validated. No results were applied. Please try again.");
      }
      setCues(sourceCues);
      setFindings(review.findings);
      setDirectCueEdits({});
      setHasCompletedReview(true);
      setShowRemainingOnly(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "TimeoutError" ? "Proofing timed out. Please try again or use a shorter transcript." : cause instanceof Error ? cause.message : "Proofing could not be completed.");
    } finally {
      setIsReviewing(false);
    }
  }

  function resolve(index: number, resolution: Resolution) {
    setFindings((current) => current.map((finding, itemIndex) => itemIndex === index ? { ...finding, resolution, isEditing: false } : finding));
    focusProgress();
  }

  function focusProgress() {
    progressRef.current?.focus({ preventScroll: true });
    progressRef.current?.scrollIntoView({ block: "start" });
  }

  function beginEdit(index: number) {
    setFindings((current) => current.map((finding, itemIndex) => itemIndex === index ? {
      ...finding,
      isEditing: true,
      draftTexts: Object.fromEntries(finding.cues.map((member) => [member.cueId,
        finding.resolution === "edited" ? finding.editedTexts![member.cueId]
          : finding.resolution === "kept" || finding.kind === "audio_check" ? resolvedCues.find((cue) => cue.id === member.cueId)!.text
          : member.proposedText!,
      ])),
    } : finding));
  }

  function updateEdit(index: number, cueId: string, text: string) {
    setFindings((current) => current.map((finding, itemIndex) => itemIndex === index ? { ...finding, draftTexts: { ...finding.draftTexts, [cueId]: text } } : finding));
  }

  function saveEdit(index: number) {
    setFindings((current) => current.map((finding, itemIndex) => itemIndex === index && finding.cues.every((member) => finding.draftTexts?.[member.cueId]?.trim())
      ? { ...finding, resolution: "edited", editedTexts: finding.draftTexts, isEditing: false } : finding));
    focusProgress();
  }

  function cancelEdit(index: number) {
    setFindings((current) => current.map((finding, itemIndex) => itemIndex === index ? { ...finding, isEditing: false, draftTexts: undefined } : finding));
  }

  function beginDirectCueEdit(cue: SubtitleCue) {
    setDirectCueEdits((current) => ({ ...current, [cue.id]: { draft: current[cue.id]?.savedText ?? cue.text, isEditing: true, savedText: current[cue.id]?.savedText } }));
  }

  function updateDirectCueEdit(cueId: string, draft: string) {
    setDirectCueEdits((current) => ({ ...current, [cueId]: { ...current[cueId], draft, isEditing: true } }));
  }

  function saveDirectCueEdit(cueId: string) {
    setDirectCueEdits((current) => {
      const edit = current[cueId];
      return edit?.draft.trim() ? { ...current, [cueId]: { ...edit, savedText: edit.draft, isEditing: false } } : current;
    });
  }

  function downloadVtt() {
    if (!exportReady) return;
    const blob = new Blob([toWebVtt(resolvedCues)], { type: "text/vtt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileBaseName}-proofed.vtt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle light and dark mode" title="Toggle light and dark mode">
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></svg>
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6 8.5 8.5 0 1 0 20.4 14.2Z" /></svg>
      </button>
      <section className="intro">
        <h1>Subtitle proofing and conversion</h1>
        <p>Review subtitle text in context, resolve proposed edits and audio checks, then download a WebVTT file.</p>
      </section>

      {demonstration && <aside className="demo-notice"><strong>Local demonstration</strong><p>These are fixed examples for trying the controls, not a live AI review. The transcript is invented.</p><button type="button" onClick={() => { setCues(initialReview!.cues); setFindings(initialReview!.findings); setDirectCueEdits({}); setHasCompletedReview(true); setShowRemainingOnly(true); setError(""); }}>Reset demonstration</button></aside>}
      <section className={`card upload-card${activeStep === 1 ? " active-step" : ""}`} aria-labelledby="upload-title">
        <h2 id="upload-title">1. Upload the transcript</h2>
        <p className="muted">Upload a timestamped Word transcript. The importer identifies cue text and removes document formatting such as cue numbers, headings and production notes.</p>
        <div className="format-example" aria-label="Supported timestamp examples"><code>00:00:19:02 00:00:20:22<br />00:00:19:02 - 00:00:20:22<br />01:00:19.080 --&gt; 01:00:20.880</code></div>
        {!demonstration && <div className="upload-controls">
          <label className={`file-input${isImporting || isReviewing ? " disabled" : ""}`}>Choose .docx<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFile} disabled={isImporting || isReviewing} /></label>
        </div>}
        {isImporting && <p className="muted import-status" role="status">Interpreting transcript…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {cues.length > 0 && <>
          <p className="success">Loaded {cues.length} timestamped cues; removed {ignoredImportLines.length} formatting line{ignoredImportLines.length === 1 ? "" : "s"}. Timings were preserved exactly.</p>
          {ignoredImportLines.length > 0 && <details className="import-audit">
            <summary>Review removed source lines</summary>
            <ul>{ignoredImportLines.map((line) => <li key={line.id}><span>{noiseCategoryLabels[line.category]}</span>{line.text}</li>)}</ul>
          </details>}
        </>}
      </section>

      {cues.length > 0 && <section className={`card${activeStep === 2 ? " active-step" : ""}`} aria-labelledby="review-title" aria-busy={isReviewing}>
        <h2 id="review-title">2. Review the text in context</h2>
        <p className="muted">The AI reads neighbouring cues together. It cannot hear the video. Check flagged passages against the audio and review the final video before delivery.</p>
        {!demonstration && <button className="review-button" type="button" onClick={requestReview} disabled={isReviewing || isImporting || hasOpenEditor || (hasCompletedReview && unresolved > 0)}>{isReviewing ? "Reviewing…" : hasCompletedReview ? "Review current text again" : "Run proofing review"}</button>}
        {isReviewing && <p role="status">Checking the transcript for edits and passages that need an audio check…</p>}
        {hasCompletedReview && findings.length === 0 && <p role="status">No edits or audio checks were identified. This is not a guarantee that the transcript is error-free. Check the final video before delivery.</p>}
        {hasCompletedReview && findings.length > 0 && <div className="review-progress" ref={progressRef} tabIndex={-1} aria-label="Review progress">
          <div className="review-progress-summary" role="status"><strong>{editCount} proposed edit{editCount === 1 ? "" : "s"} · {checkCount} audio check{checkCount === 1 ? "" : "s"}</strong><span>{resolved} of {findings.length} resolved</span></div>
          <div className="review-progress-track" role="progressbar" aria-label="Review progress" aria-valuemin={0} aria-valuemax={findings.length} aria-valuenow={resolved}><span style={{ width: `${resolved / findings.length * 100}%` }} /></div>
          <label className="remaining-filter"><input type="checkbox" checked={showRemainingOnly} onChange={(event) => setShowRemainingOnly(event.target.checked)} /> Show unresolved items only</label>
        </div>}
        {hasCompletedReview && showRemainingOnly && visibleFindings.length === 0 && findings.length > 0 && <p className="muted">Every review item has a decision. You can show resolved items to revisit them.</p>}
        <fieldset className="review-controls" disabled={isReviewing || !hasCompletedReview}>
        <legend className="sr-only">Review decisions</legend>
        {visibleFindings.map(({ finding, index }) => {
          const isAudio = finding.kind === "audio_check";
          const ids = new Set(finding.cues.map((member) => member.cueId));
          const first = cues.findIndex((cue) => cue.id === finding.cues[0].cueId);
          const last = cues.findIndex((cue) => cue.id === finding.cues.at(-1)!.cueId);
          const context = resolvedCues.slice(Math.max(0, first - 1), last + 2);
          const linked = finding.cues.length > 1;
          return <article className={`suggestion${isAudio ? " audio-check" : ""}`} key={index} aria-labelledby={`finding-${index}`}>
            <h3 id={`finding-${index}`}>{isAudio ? "Check against audio" : linked ? "Linked edit" : "Proposed edit"}</h3>
            {linked && <p className="muted">Review these {finding.cues.length} cues together.</p>}
            <p>{finding.reason}</p>
            {isAudio && <p className="check-question"><strong>{finding.question}</strong></p>}
            <details className="cue-context" open={isAudio}>
              <summary>Read in context</summary>
              <ol>{context.map((cue) => <li key={cue.id} className={ids.has(cue.id) ? "affected-cue" : ""}><span>Cue {cue.id} · {cue.start}</span> {cue.text}</li>)}</ol>
            </details>
            {finding.cues.map((member) => {
              const cue = cues.find((item) => item.id === member.cueId)!;
              const finalCue = resolvedCues.find((item) => item.id === member.cueId)!;
              const layoutIssue = overlongCues.find((issue) => issue.cueId === member.cueId);
              return <div className="finding-cue" key={member.cueId}>
                <p className="cue-label">Cue {member.cueId} · {cue.start} → {cue.end}</p>
                <p><strong>Original:</strong> {cue.text}</p>
                {!isAudio && <p><strong>Proposed:</strong> <ProposedText original={cue.text} proposed={member.proposedText!} /></p>}
                {finding.resolution === "edited" && <p><strong>Saved text:</strong> {finalCue.text}</p>}
                {layoutIssue && <CaptionLayout text={finalCue.text} lineCount={layoutIssue.lineCount} />}
              </div>;
            })}
            <p className="evidence"><a href={referenceUrlFor(finding.referenceUrl, finding.referenceEntry)} target="_blank" rel="noreferrer">{referenceLabelFor(finding.referenceUrl)}: {finding.referenceEntry}</a></p>
            {finding.resolution && !finding.isEditing && <p className="decision-status">{finding.resolution === "approved" ? "Proposed edits approved" : finding.resolution === "edited" ? "Your edited text is saved" : isAudio ? "Audio checked — original text kept" : "Proposed edits rejected — original text kept"}</p>}
            {!finding.isEditing && <div className="resolution-actions">
              {!isAudio && <button type="button" className={finding.resolution === "approved" ? "selected" : ""} onClick={() => resolve(index, "approved")}>{linked ? "Approve linked edits" : "Approve edit"}</button>}
              <button type="button" className={finding.resolution === "kept" ? "selected" : ""} onClick={() => resolve(index, "kept")}>{isAudio ? "Checked — keep original" : linked ? "Reject linked edits" : "Reject edit"}</button>
              <button type="button" className="edit-decision" onClick={() => beginEdit(index)}>{isAudio ? "Edit after checking" : linked ? "Edit together" : "Edit"}</button>
            </div>}
            {finding.isEditing && <form className="edit-field" onSubmit={(event) => { event.preventDefault(); saveEdit(index); }}>
              {finding.cues.map((member) => <label key={member.cueId}>Cue {member.cueId} final text<textarea value={finding.draftTexts?.[member.cueId] ?? ""} onChange={(event) => updateEdit(index, member.cueId, event.target.value)} required /></label>)}
              <div className="form-actions"><button type="submit" disabled={!finding.cues.every((member) => finding.draftTexts?.[member.cueId]?.trim())}>{isAudio ? "Save checked text" : "Save edits together"}</button><button type="button" onClick={() => cancelEdit(index)}>Cancel</button></div>
            </form>}
          </article>;
        })}
        {layoutOnlyCues.map(({ issue, cue }) => {
          const edit = directCueEdits[cue.id];
          return <article className="suggestion" key={`layout-${cue.id}`}>
            <p className="cue-label">Cue {cue.id} · {cue.start} → {cue.end}</p>
            <CaptionLayout text={cue.text} lineCount={issue.lineCount} />
            {!edit?.isEditing && <button type="button" onClick={() => beginDirectCueEdit(cue)}>Edit final text</button>}
            {edit?.isEditing && <form className="edit-field" onSubmit={(event) => { event.preventDefault(); saveDirectCueEdit(cue.id); }}><label>Final text<textarea value={edit.draft} onChange={(event) => updateDirectCueEdit(cue.id, event.target.value)} required /></label><button type="submit" disabled={!edit.draft.trim()}>Save edit</button></form>}
          </article>;
        })}
        </fieldset>
      </section>}

      {cues.length > 0 && <section className={`card export-card${activeStep === 3 ? " active-step" : ""}`} aria-labelledby="export-title">
        <h2 id="export-title">3. Export WebVTT</h2>
        <p className="muted">{!hasCompletedReview ? "Complete a successful proofing review before exporting." : hasOpenEditor ? "Save or cancel your open edits before exporting." : unresolved ? `${unresolved} review item${unresolved === 1 ? "" : "s"} still need a decision.` : overlongCues.length ? "Caption layout needs attention before export." : "All review items are resolved. Check the exported subtitles against the final video before delivery."}</p>
        {overlongCues.length > 0 && <p className="error" role="alert">Cue{overlongCues.length === 1 ? "" : "s"} {overlongCues.map((cue) => `${cue.cueId} (${cue.lineCount} lines)`).join(", ")} cannot fit within two 42-character caption lines. Edit and save the affected cue in this review first. Re-upload only if its timing also needs changing.</p>}
        <button type="button" onClick={downloadVtt} disabled={!exportReady}>Download .vtt</button>
      </section>}
    </main>
  );
}
