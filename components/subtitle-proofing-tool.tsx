"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { styleGuideUrlFor, type ReviewSuggestion } from "../lib/review";
import { changedProposedSegments } from "../lib/proposed-changes";
import { extractTranscriptLines } from "../lib/docx";
import type { IgnoredImportLine, SubtitleImportResult } from "../lib/import";
import { findOverlongCues, formatCueText, MAX_CAPTION_LINE_LENGTH, SubtitleCue, SubtitleFormatError, toWebVtt } from "../lib/subtitles";

type Resolution = "approved" | "rejected" | "edited";
type SuggestionWithResolution = ReviewSuggestion & { resolution?: Resolution; editedText?: string; isEditing?: boolean };
type DirectCueEdit = { draft: string; isEditing: boolean; savedText?: string };

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

export function SubtitleProofingTool() {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionWithResolution[]>([]);
  const [hasCompletedReview, setHasCompletedReview] = useState(false);
  const [fileBaseName, setFileBaseName] = useState("subtitles");
  const [error, setError] = useState("");
  const [ignoredImportLines, setIgnoredImportLines] = useState<IgnoredImportLine[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showRemainingOnly, setShowRemainingOnly] = useState(true);
  const [directCueEdits, setDirectCueEdits] = useState<Record<string, DirectCueEdit>>({});

  const resolvedCues = useMemo(() => {
    const next = new Map(cues.map((cue) => [cue.id, cue]));
    for (const suggestion of suggestions) {
      if (!suggestion.resolution) continue;
      const cue = next.get(suggestion.cueId);
      if (!cue) continue;
      const text = suggestion.resolution === "approved" ? suggestion.proposedText : suggestion.resolution === "edited" ? suggestion.editedText?.trim() : cue.text;
      if (text) next.set(cue.id, { ...cue, text });
    }
    for (const [cueId, edit] of Object.entries(directCueEdits)) {
      const cue = next.get(cueId);
      if (cue && edit.savedText?.trim()) next.set(cueId, { ...cue, text: edit.savedText.trim() });
    }
    return [...next.values()];
  }, [cues, directCueEdits, suggestions]);
  const overlongCues = useMemo(() => findOverlongCues(resolvedCues), [resolvedCues]);
  const overlongCueIds = useMemo(() => new Set(overlongCues.map((cue) => cue.cueId)), [overlongCues]);
  const unresolved = suggestions.filter((suggestion) => !suggestion.resolution || overlongCueIds.has(suggestion.cueId)).length;
  const resolved = suggestions.length - unresolved;
  const visibleSuggestions = suggestions
    .map((suggestion, index) => ({ suggestion, index }))
    .filter(({ suggestion }) => !showRemainingOnly || !suggestion.resolution || overlongCueIds.has(suggestion.cueId));
  const layoutOnlyCues = overlongCues
    .filter((issue) => !suggestions.some((suggestion) => suggestion.cueId === issue.cueId))
    .map((issue) => ({ issue, cue: resolvedCues.find((cue) => cue.id === issue.cueId) }))
    .filter((item): item is { issue: typeof overlongCues[number]; cue: SubtitleCue } => Boolean(item.cue));
  const activeStep = !cues.length ? 1 : hasCompletedReview && unresolved === 0 && overlongCues.length === 0 ? 3 : 2;

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
    setSuggestions([]);
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
    setError("");
    setHasCompletedReview(false);
    setIsReviewing(true);
    try {
      const reviewCues = cues.map(({ id, text }) => ({ id, text }));
      // Webflow Cloud apps can be mounted below a site's root (for example,
      // /subtitle-proofing). Resolve the endpoint from the current app page so
      // it does not accidentally request the parent Webflow site's /api route.
      const appPath = window.location.pathname.replace(/\/$/, "");
      const response = await fetch(`${appPath}/api/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cues: reviewCues }),
      });
      const responseText = await response.text();
      let payload: { suggestions?: ReviewSuggestion[]; error?: string };
      try {
        payload = JSON.parse(responseText) as { suggestions?: ReviewSuggestion[]; error?: string };
      } catch {
        throw new Error(
          `The proofing service returned ${response.status} ${response.statusText || "response"}, not JSON. Check the Webflow Cloud deployment and mount path.`,
        );
      }
      if (!response.ok || !payload.suggestions) throw new Error(payload.error || "Proofing could not be completed.");
      setSuggestions(payload.suggestions);
      setHasCompletedReview(true);
      setShowRemainingOnly(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Proofing could not be completed.");
    } finally {
      setIsReviewing(false);
    }
  }

  function resolve(index: number, resolution: Resolution) {
    setSuggestions((current) => current.map((suggestion, itemIndex) => itemIndex === index ? { ...suggestion, resolution, isEditing: false } : suggestion));
  }

  function updateEdit(index: number, editedText: string) {
    setSuggestions((current) => current.map((suggestion, itemIndex) => itemIndex === index ? { ...suggestion, editedText } : suggestion));
  }

  function beginEdit(index: number, finalText: string) {
    setSuggestions((current) => current.map((suggestion, itemIndex) => itemIndex === index ? { ...suggestion, resolution: undefined, isEditing: true, editedText: suggestion.resolution === "edited" ? suggestion.editedText ?? finalText : finalText } : suggestion));
  }

  function saveEdit(index: number) {
    setSuggestions((current) => current.map((suggestion, itemIndex) => itemIndex === index ? { ...suggestion, resolution: "edited", isEditing: false } : suggestion));
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
        <p>Upload a timestamped Word transcript, resolve every evidenced editorial proposal, then download a WebVTT file.</p>
      </section>

      <section className={`card upload-card${activeStep === 1 ? " active-step" : ""}`} aria-labelledby="upload-title">
        <h2 id="upload-title">1. Upload the transcript</h2>
        <p className="muted">Upload a timestamped Word transcript. The importer identifies cue text and removes document formatting such as cue numbers, headings and production notes.</p>
        <div className="format-example" aria-label="Supported timestamp examples"><code>00:00:19:02 00:00:20:22<br />00:00:19:02 - 00:00:20:22<br />01:00:19.080 --&gt; 01:00:20.880</code></div>
        <div className="upload-controls">
          <label className={`file-input${isImporting ? " disabled" : ""}`}>Choose .docx<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFile} disabled={isImporting} /></label>
        </div>
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

      {cues.length > 0 && <section className={`card${activeStep === 2 ? " active-step" : ""}`} aria-labelledby="review-title">
        <div className="section-heading"><div><h2 id="review-title">2. Proof the text</h2><p className="muted">The review proposes changes only. You remain responsible for every decision.</p>{suggestions.length === 0 && !isReviewing && <p>{hasCompletedReview ? layoutOnlyCues.length ? "No editorial changes were proposed. Caption layout still needs attention below." : "No changes were proposed. You can export the reviewed WebVTT." : "No proposals yet. Run the review to check against the BBC News Style Guide."}</p>}<button className="review-button" type="button" onClick={requestReview} disabled={isReviewing}>{isReviewing ? "Proofing…" : "Run proofing review"}</button></div></div>
        {hasCompletedReview && suggestions.length > 0 && <div className="review-progress" aria-live="polite">
          <div className="review-progress-summary"><strong>{suggestions.length} proposed edit{suggestions.length === 1 ? "" : "s"}</strong><span>{resolved} of {suggestions.length} actioned</span></div>
          <div className="review-progress-track" role="progressbar" aria-label="Proposal review progress" aria-valuemin={0} aria-valuemax={suggestions.length} aria-valuenow={resolved}><span style={{ width: `${(resolved / suggestions.length) * 100}%` }} /></div>
          <label className="remaining-filter"><input type="checkbox" checked={showRemainingOnly} onChange={(event) => setShowRemainingOnly(event.target.checked)} /> Show remaining proposals only</label>
        </div>}
        {hasCompletedReview && showRemainingOnly && visibleSuggestions.length === 0 && layoutOnlyCues.length === 0 && <p className="muted">Every proposal has been actioned.</p>}
        {visibleSuggestions.map(({ suggestion, index }) => {
          const cue = cues.find((item) => item.id === suggestion.cueId);
          const finalCue = resolvedCues.find((item) => item.id === suggestion.cueId);
          const layoutIssue = overlongCues.find((issue) => issue.cueId === suggestion.cueId);
          return <article className="suggestion" key={`${suggestion.cueId}-${index}`}>
            <p className="cue-label">Cue {suggestion.cueId} · {cue?.start} → {cue?.end}</p>
            <p><strong>Original:</strong> {cue?.text}</p>
            <p><strong>Proposed:</strong> <ProposedText original={cue?.text ?? ""} proposed={suggestion.proposedText} /></p>
            <p className="evidence">{suggestion.reason} <a href={styleGuideUrlFor(suggestion.referenceEntry)} target="_blank" rel="noreferrer"><span className="link-favicon" aria-hidden="true" />BBC News Style Guide: {suggestion.referenceEntry}</a></p>
            {layoutIssue && finalCue && <CaptionLayout text={finalCue.text} lineCount={layoutIssue.lineCount} />}
            <div className="resolution-actions"><button type="button" className={suggestion.resolution === "approved" ? "selected" : ""} onClick={() => resolve(index, "approved")}>Approve</button><button type="button" className={suggestion.resolution === "rejected" ? "selected" : ""} onClick={() => resolve(index, "rejected")}>Reject</button><button type="button" className={suggestion.resolution === "edited" || suggestion.isEditing ? "selected" : ""} onClick={() => beginEdit(index, finalCue?.text ?? suggestion.proposedText)}>Edit</button></div>
            {suggestion.isEditing && <form className="edit-field" onSubmit={(event) => { event.preventDefault(); saveEdit(index); }}><label>Final text<textarea value={suggestion.editedText ?? finalCue?.text ?? suggestion.proposedText} onChange={(event) => updateEdit(index, event.target.value)} required /></label><button type="submit" disabled={!suggestion.editedText?.trim()}>Save edit</button></form>}
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
      </section>}

      {cues.length > 0 && <section className={`card export-card${activeStep === 3 ? " active-step" : ""}`} aria-labelledby="export-title">
        <h2 id="export-title">3. Export WebVTT</h2>
        <p className="muted">{!hasCompletedReview ? "Run and complete the proofing review before exporting." : unresolved ? `${unresolved} proposal${unresolved === 1 ? "" : "s"} still need${unresolved === 1 ? "s" : ""} a decision.` : overlongCues.length ? "Caption layout needs attention before export." : suggestions.length ? "All proposals have been resolved." : "The review found no proposed changes."}</p>
        {overlongCues.length > 0 && <p className="error" role="alert">Cue{overlongCues.length === 1 ? "" : "s"} {overlongCues.map((cue) => `${cue.cueId} (${cue.lineCount} lines)`).join(", ")} cannot fit within two 42-character caption lines. Edit and save the affected cue in this review first. Re-upload only if its timing also needs changing.</p>}
        <button type="button" onClick={downloadVtt} disabled={!hasCompletedReview || unresolved > 0 || overlongCues.length > 0}>Download .vtt</button>
      </section>}
    </main>
  );
}
