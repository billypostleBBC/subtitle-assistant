import { describe, expect, it } from "vitest";
import { BBC_SUBTITLE_GUIDE_URL, reviewRequestSchema, validateReview, type ReviewFinding } from "./review";

const cues = [
  { id: "a", text: "We rely on one simple habit." },
  { id: "b", text: "Writing a little every day." },
  { id: "c", text: "Sometimes I wonder..." },
];
const linked: ReviewFinding = {
  kind: "edit",
  cues: [{ cueId: "a", proposedText: "We rely on one simple habit:" }, { cueId: "b", proposedText: "writing a little every day." }],
  reason: "The second cue explains the habit in the first.",
  question: null,
  referenceEntry: "3.4 Break at natural points",
  referenceUrl: BBC_SUBTITLE_GUIDE_URL,
};

describe("validateReview", () => {
  it("preserves linked changes and adds an audio check for an unreported ellipsis", () => {
    const result = validateReview({ findings: [linked] }, cues);
    expect(result.findings[0]).toEqual(linked);
    expect(result.findings[1]).toMatchObject({ kind: "audio_check", cues: [{ cueId: "c", proposedText: null }], question: expect.stringContaining("pause") });
  });

  it("never presents a model's ellipsis removal as a confident edit", () => {
    const result = validateReview({ findings: [{ ...linked, cues: [{ cueId: "c", proposedText: "Sometimes I wonder." }] }] }, cues.slice(2));
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ kind: "audio_check", cues: [{ cueId: "c", proposedText: null }] });
  });

  it("does not duplicate an existing audio check", () => {
    const finding = { ...linked, kind: "audio_check", cues: [{ cueId: "c", proposedText: null }], question: "Does the speaker trail off?" };
    expect(validateReview({ findings: [finding] }, cues).findings).toEqual([finding]);
  });

  it("lets the reviewer edit an ellipsis continuation and stays stable on client revalidation", () => {
    const passage = [{ id: "1", text: "If I could..." }, { id: "2", text: "Start again." }, { id: "3", text: "We will see." }];
    const result = validateReview({ findings: [] }, passage);
    expect(result.findings[0].cues).toEqual([{ cueId: "1", proposedText: null }, { cueId: "2", proposedText: null }]);
    expect(validateReview(result, passage)).toEqual(result);
  });

  it("never claims a continuation already owned by another finding", () => {
    const passage = [{ id: "1", text: "Perhaps..." }, { id: "2", text: "My favorite color is red." }];
    const correction = { ...linked, cues: [{ cueId: "2", proposedText: "My favourite colour is red." }] };
    const result = validateReview({ findings: [correction] }, passage);
    expect(result.findings[0].cues).toEqual([{ cueId: "1", proposedText: null }]);
    expect(result.findings[1]).toEqual(correction);
  });

  it.each([
    ["unknown cue", { ...linked, cues: [{ cueId: "missing", proposedText: "Hello." }] }],
    ["duplicate cue", { ...linked, cues: [linked.cues[0], linked.cues[0]] }],
    ["empty replacement", { ...linked, cues: [{ cueId: "a", proposedText: "   " }] }],
    ["unchanged replacement", { ...linked, cues: [{ cueId: "a", proposedText: cues[0].text }] }],
    ["invented citation", { ...linked, referenceEntry: "invented" }],
    ["prototype citation", { ...linked, referenceEntry: "constructor" }],
    ["blank citation", { ...linked, referenceUrl: "https://www.bbc.co.uk/newsstyleguide/all/", referenceEntry: "   " }],
    ["missing replacement", { ...linked, cues: [{ cueId: "a", proposedText: null }] }],
    ["missing question", { ...linked, kind: "audio_check", cues: [{ cueId: "a", proposedText: null }] }],
    ["check with replacement", { ...linked, kind: "audio_check", question: "Check it?" }],
  ])("rejects the whole review for %s rather than dropping a finding", (_, finding) => {
    expect(() => validateReview({ findings: [finding] }, cues)).toThrow();
  });

  it("rejects overlapping findings so one decision cannot overwrite another", () => {
    expect(() => validateReview({ findings: [linked, linked] }, cues)).toThrow(/more than one/);
  });

  it("rejects copying a neighbouring cue into a replacement", () => {
    const merged = { ...linked, cues: [{ cueId: "a", proposedText: "We rely on one simple habit: writing a little every day." }] };
    expect(() => validateReview({ findings: [merged] }, cues)).toThrow(/neighbouring/);
  });

  it("rejects a legacy or malformed response rather than reporting no changes", () => {
    expect(() => validateReview({ suggestions: [] }, cues)).toThrow();
    expect(() => validateReview(null, cues)).toThrow();
  });

  it("accepts a clean review without inventing findings", () => {
    expect(validateReview({ findings: [] }, cues.slice(0, 2))).toEqual({ findings: [] });
  });
});

describe("review request limits", () => {
  it("accepts 800 cues and refuses the 801st", () => {
    const many = Array.from({ length: 800 }, (_, index) => ({ id: String(index), text: "A short sentence." }));
    expect(reviewRequestSchema.safeParse({ cues: many }).success).toBe(true);
    expect(reviewRequestSchema.safeParse({ cues: [...many, { id: "800", text: "One too many." }] }).success).toBe(false);
    expect(validateReview({ findings: [] }, many).findings).toEqual([]);
  });

  it("accepts exactly 80,000 text characters and refuses one more", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ id: String(index), text: "a".repeat(4000) }));
    expect(reviewRequestSchema.safeParse({ cues: many }).success).toBe(true);
    expect(reviewRequestSchema.safeParse({ cues: [...many, { id: "20", text: "b" }] }).success).toBe(false);
  });

  it("refuses overlong cue text and IDs that collide after trimming", () => {
    expect(reviewRequestSchema.safeParse({ cues: [{ id: "1", text: "a".repeat(4001) }] }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ cues: [{ id: "1", text: "First." }, { id: " 1 ", text: "Second." }] }).success).toBe(false);
  });
});
