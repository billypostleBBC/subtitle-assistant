"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { styleGuideUrlFor, type ReviewSuggestion } from "../lib/review";
import { changedProposedSegments } from "../lib/proposed-changes";
import { extractTranscriptText } from "../lib/docx";
import { findOverlongCues, parseAlternatingTranscript, SubtitleCue, SubtitleFormatError, toWebVtt } from "../lib/subtitles";

type Resolution = "approved" | "rejected" | "edited";
type SuggestionWithResolution = ReviewSuggestion & { resolution?: Resolution; editedText?: string; isEditing?: boolean };
const FRAME_RATE = 25;

function ProposedText({ original, proposed }: { original: string; proposed: string }) {
  return <>{changedProposedSegments(original, proposed).map((segment, index) => segment.changed ? <mark key={index}>{segment.text}</mark> : segment.text)}</>;
}

export function SubtitleProofingTool() {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionWithResolution[]>([]);
  const [hasCompletedReview, setHasCompletedReview] = useState(false);
  const [fileBaseName, setFileBaseName] = useState("subtitles");
  const [error, setError] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [showRemainingOnly, setShowRemainingOnly] = useState(true);

  const unresolved = suggestions.filter((suggestion) => !suggestion.resolution).length;
  const resolved = suggestions.length - unresolved;
  const visibleSuggestions = suggestions
    .map((suggestion, index) => ({ suggestion, index }))
    .filter(({ suggestion }) => !showRemainingOnly || !suggestion.resolution);
  const resolvedCues = useMemo(() => {
    const next = new Map(cues.map((cue) => [cue.id, cue]));
    for (const suggestion of suggestions) {
      if (!suggestion.resolution) continue;
      const cue = next.get(suggestion.cueId);
      if (!cue) continue;
      const text = suggestion.resolution === "approved" ? suggestion.proposedText : suggestion.resolution === "edited" ? suggestion.editedText?.trim() : cue.text;
      if (text) next.set(cue.id, { ...cue, text });
    }
    return [...next.values()];
  }, [cues, suggestions]);
  const overlongCues = useMemo(() => findOverlongCues(resolvedCues), [resolvedCues]);

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
    setSuggestions([]);
    setHasCompletedReview(false);
    setShowRemainingOnly(true);
    try {
      if (!file.name.toLowerCase().endsWith(".docx")) throw new SubtitleFormatError("Upload a .docx document.");
      const parsed = parseAlternatingTranscript(await extractTranscriptText(await file.arrayBuffer()), FRAME_RATE);
      setCues(parsed);
      setFileBaseName(file.name.replace(/\.docx$/i, "") || "subtitles");
    } catch (cause) {
      setCues([]);
      setError(cause instanceof Error ? cause.message : "The document could not be read.");
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

  function beginEdit(index: number, proposedText: string) {
    setSuggestions((current) => current.map((suggestion, itemIndex) => itemIndex === index ? { ...suggestion, resolution: undefined, isEditing: true, editedText: suggestion.editedText ?? proposedText } : suggestion));
  }

  function saveEdit(index: number) {
    setSuggestions((current) => current.map((suggestion, itemIndex) => itemIndex === index ? { ...suggestion, resolution: "edited", isEditing: false } : suggestion));
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

      <section className="card upload-card" aria-labelledby="upload-title">
        <h2 id="upload-title">1. Upload the transcript</h2>
        <p className="muted">Supported format: alternating timestamp and transcript lines at 25 fps.</p>
        <div className="format-example" aria-label="Timestamp and transcript example"><code>00:00:19:02 - 00:00:20:22<br />The transcript line goes here.</code></div>
        <div className="upload-controls">
          <label className="file-input">Choose .docx<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFile} /></label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {cues.length > 0 && <p className="success">Loaded {cues.length} timestamped cues. Timings will be preserved exactly.</p>}
      </section>

      {cues.length > 0 && <section className="card" aria-labelledby="review-title">
        <div className="section-heading"><div><h2 id="review-title">2. Proof the text</h2><p className="muted">The review proposes changes only. You remain responsible for every decision.</p></div><button type="button" onClick={requestReview} disabled={isReviewing}>{isReviewing ? "Proofing…" : "Run proofing review"}</button></div>
        {suggestions.length === 0 && !isReviewing && <p>{hasCompletedReview ? "No changes were proposed. You can export the reviewed WebVTT." : "No proposals yet. Run the review to check against the BBC News Style Guide."}</p>}
        {hasCompletedReview && suggestions.length > 0 && <div className="review-progress" aria-live="polite">
          <div className="review-progress-summary"><strong>{suggestions.length} proposed edit{suggestions.length === 1 ? "" : "s"}</strong><span>{resolved} of {suggestions.length} actioned</span></div>
          <div className="review-progress-track" role="progressbar" aria-label="Proposal review progress" aria-valuemin={0} aria-valuemax={suggestions.length} aria-valuenow={resolved}><span style={{ width: `${(resolved / suggestions.length) * 100}%` }} /></div>
          <label className="remaining-filter"><input type="checkbox" checked={showRemainingOnly} onChange={(event) => setShowRemainingOnly(event.target.checked)} /> Show remaining proposals only</label>
        </div>}
        {showRemainingOnly && visibleSuggestions.length === 0 && <p className="muted">Every proposal has been actioned.</p>}
        {visibleSuggestions.map(({ suggestion, index }) => {
          const cue = cues.find((item) => item.id === suggestion.cueId);
          return <article className="suggestion" key={`${suggestion.cueId}-${index}`}>
            <p className="cue-label">Cue {suggestion.cueId} · {cue?.start} → {cue?.end}</p>
            <p><strong>Original:</strong> {cue?.text}</p>
            <p><strong>Proposed:</strong> <ProposedText original={cue?.text ?? ""} proposed={suggestion.proposedText} /></p>
            <p className="evidence">{suggestion.reason} <a href={styleGuideUrlFor(suggestion.referenceEntry)} target="_blank" rel="noreferrer"><span className="link-favicon" aria-hidden="true" />BBC News Style Guide: {suggestion.referenceEntry}</a></p>
            <div className="resolution-actions"><button type="button" className={suggestion.resolution === "approved" ? "selected" : ""} onClick={() => resolve(index, "approved")}>Approve</button><button type="button" className={suggestion.resolution === "rejected" ? "selected" : ""} onClick={() => resolve(index, "rejected")}>Reject</button><button type="button" className={suggestion.resolution === "edited" || suggestion.isEditing ? "selected" : ""} onClick={() => beginEdit(index, suggestion.proposedText)}>Edit</button></div>
            {suggestion.isEditing && <form className="edit-field" onSubmit={(event) => { event.preventDefault(); saveEdit(index); }}><label>Final text<textarea value={suggestion.editedText ?? suggestion.proposedText} onChange={(event) => updateEdit(index, event.target.value)} required /></label><button type="submit" disabled={!suggestion.editedText?.trim()}>Save edit</button></form>}
          </article>;
        })}
      </section>}

      {cues.length > 0 && <section className="card export-card" aria-labelledby="export-title">
        <h2 id="export-title">3. Export WebVTT</h2>
        <p className="muted">{!hasCompletedReview ? "Run and complete the proofing review before exporting." : unresolved ? `${unresolved} proposal${unresolved === 1 ? "" : "s"} still need${unresolved === 1 ? "s" : ""} a decision.` : overlongCues.length ? "Caption layout needs attention before export." : suggestions.length ? "All proposals have been resolved." : "The review found no proposed changes."}</p>
        {overlongCues.length > 0 && <p className="error" role="alert">Cue{overlongCues.length === 1 ? "" : "s"} {overlongCues.map((cue) => `${cue.cueId} (${cue.lineCount} lines)`).join(", ")} cannot fit within two 42-character caption lines. Shorten or split the affected cue timings in the source transcript, then upload it again.</p>}
        <button type="button" onClick={downloadVtt} disabled={!hasCompletedReview || unresolved > 0 || overlongCues.length > 0}>Download .vtt</button>
      </section>}
    </main>
  );
}
