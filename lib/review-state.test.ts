import { describe, expect, it } from "vitest";
import { applyReviewDecisions, canExportReview, type FindingState } from "./review-state";
import { BBC_SUBTITLE_GUIDE_URL } from "./review";

const cues = [
  { id: "1", start: "00:00:01.000", end: "00:00:03.000", text: "Try one thing." },
  { id: "2", start: "00:00:03.000", end: "00:00:05.000", text: "Writing." },
];
const linked: FindingState = { kind: "edit", cues: [{ cueId: "1", proposedText: "Try one thing:" }, { cueId: "2", proposedText: "writing." }], reason: "A linked explanation.", question: null, referenceEntry: "3.4 Break at natural points", referenceUrl: BBC_SUBTITLE_GUIDE_URL };

describe("review decisions", () => {
  it("applies both linked changes together and preserves timing, IDs and order", () => {
    const result = applyReviewDecisions(cues, [{ ...linked, resolution: "approved" }], {});
    expect(result).toEqual([{ ...cues[0], text: "Try one thing:" }, { ...cues[1], text: "writing." }]);
    expect(cues[0].text).toBe("Try one thing.");
  });

  it("keeps both originals on rejection and while a decision is pending", () => {
    expect(applyReviewDecisions(cues, [{ ...linked, resolution: "kept" }], {})).toEqual(cues);
    expect(applyReviewDecisions(cues, [linked], {})).toEqual(cues);
  });

  it("requires complete non-empty edited text before applying a linked edit", () => {
    expect(() => applyReviewDecisions(cues, [{ ...linked, resolution: "edited", editedTexts: { "1": "Hello" } }], {})).toThrow();
  });

  it("blocks export for pending checks, active editors, layout issues and failed review", () => {
    const completed = [{ ...linked, resolution: "kept" as const }];
    expect(canExportReview(true, completed, {}, 0)).toBe(true);
    expect(canExportReview(false, completed, {}, 0)).toBe(false);
    expect(canExportReview(true, [linked], {}, 0)).toBe(false);
    expect(canExportReview(true, [{ ...completed[0], isEditing: true }], {}, 0)).toBe(false);
    expect(canExportReview(true, completed, {}, 1)).toBe(false);
    expect(canExportReview(true, completed, { "1": { draft: "Hi", isEditing: true } }, 0)).toBe(false);
  });

  it("does not allow an audio check to be approved as an AI replacement", () => {
    const check: FindingState = { ...linked, kind: "audio_check", cues: [{ cueId: "1", proposedText: null }], question: "Does the speaker pause?", resolution: "approved" };
    expect(canExportReview(true, [check], {}, 0)).toBe(false);
    expect(() => applyReviewDecisions(cues, [check], {})).toThrow();
  });
});
