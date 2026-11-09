import type { ReviewFinding } from "./review";
import type { SubtitleCue } from "./subtitles";

export type Resolution = "approved" | "kept" | "edited";
export type FindingState = ReviewFinding & { resolution?: Resolution; editedTexts?: Record<string, string>; draftTexts?: Record<string, string>; isEditing?: boolean };
export type DirectCueEdit = { draft: string; isEditing: boolean; savedText?: string };

export function isFindingResolved(finding: FindingState) {
  if (finding.isEditing || !finding.resolution) return false;
  if (finding.resolution === "approved") return finding.kind === "edit" && finding.cues.every((cue) => Boolean(cue.proposedText?.trim()));
  if (finding.resolution === "edited") return finding.cues.every((cue) => Boolean(finding.editedTexts?.[cue.cueId]?.trim()));
  return true;
}

export function applyReviewDecisions(cues: SubtitleCue[], findings: FindingState[], directEdits: Record<string, DirectCueEdit>) {
  const next = new Map(cues.map((cue) => [cue.id, { ...cue }]));
  for (const finding of findings) {
    if (!finding.resolution) continue;
    if (!isFindingResolved({ ...finding, isEditing: false })) throw new Error("The review decision is incomplete.");
    for (const member of finding.cues) {
      const cue = next.get(member.cueId);
      if (!cue) throw new Error("The review decision refers to an unknown cue.");
      if (finding.resolution === "approved") cue.text = member.proposedText!.trim();
      if (finding.resolution === "edited") cue.text = finding.editedTexts![member.cueId].trim();
    }
  }
  for (const [id, edit] of Object.entries(directEdits)) {
    const cue = next.get(id);
    if (cue && edit.savedText?.trim()) cue.text = edit.savedText.trim();
  }
  return [...next.values()];
}

export function canExportReview(completed: boolean, findings: FindingState[], directEdits: Record<string, DirectCueEdit>, layoutIssueCount: number) {
  return completed && findings.every(isFindingResolved) && !Object.values(directEdits).some((edit) => edit.isEditing) && layoutIssueCount === 0;
}
