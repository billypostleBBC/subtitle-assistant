import { describe, expect, it } from "vitest";
import {
  BBC_SUBTITLE_GUIDE_URL,
  hasEditorialChange,
  isSupportedReviewReference,
  referenceLabelFor,
  referenceUrlFor,
  REVIEW_INSTRUCTIONS,
  reviewSchema,
  STYLE_GUIDE_URL,
  styleGuideUrlFor,
} from "./review";

describe("styleGuideUrlFor", () => {
  it("links to the alphabetical section containing the referenced entry", () => {
    expect(styleGuideUrlFor("Contractions")).toBe(`${STYLE_GUIDE_URL}#c`);
    expect(styleGuideUrlFor("Foreign words and phrases")).toBe(`${STYLE_GUIDE_URL}#f`);
  });

  it("uses the canonical guide URL when an entry has no alphabetical character", () => {
    expect(styleGuideUrlFor("123")).toBe(STYLE_GUIDE_URL);
  });
});

describe("review evidence", () => {
  it("accepts the BBC Subtitle Guidelines as proposal evidence", () => {
    expect(reviewSchema.parse({
      suggestions: [{
        cueId: "12",
        proposedText: "I have lived here for four years.",
        reason: "A light edit makes difficult speech intelligible without polishing the speaker's voice.",
        referenceEntry: "13.1 Edit lightly",
        referenceUrl: BBC_SUBTITLE_GUIDE_URL,
      }],
    }).suggestions[0].referenceUrl).toBe(BBC_SUBTITLE_GUIDE_URL);
  });

  it("deep-links subtitle guidance evidence and labels its source", () => {
    expect(referenceUrlFor(BBC_SUBTITLE_GUIDE_URL, "12.3 Incorrect grammar")).toBe(
      `${BBC_SUBTITLE_GUIDE_URL}#Incorrect-grammar`,
    );
    expect(referenceLabelFor(BBC_SUBTITLE_GUIDE_URL)).toBe("BBC Subtitle Guidelines");
    expect(isSupportedReviewReference(BBC_SUBTITLE_GUIDE_URL, "12.3 Incorrect grammar")).toBe(true);
    expect(isSupportedReviewReference(BBC_SUBTITLE_GUIDE_URL, "12.99 Invented rule")).toBe(false);
  });

  it("keeps the existing News Style Guide citation behaviour", () => {
    expect(referenceUrlFor(STYLE_GUIDE_URL, "Contractions")).toBe(`${STYLE_GUIDE_URL}#c`);
    expect(referenceLabelFor(STYLE_GUIDE_URL)).toBe("BBC News Style Guide");
  });

  it("guards against correcting dialect or polishing second-language speech", () => {
    expect(REVIEW_INSTRUCTIONS).toContain("Do not correct non-standard grammar merely because it is non-standard");
    expect(REVIEW_INSTRUCTIONS).toContain("tamper with the speaker's words as little as possible");
    expect(REVIEW_INSTRUCTIONS).toContain(BBC_SUBTITLE_GUIDE_URL);
  });
});

describe("hasEditorialChange", () => {
  it("rejects proposals that only repeat the cue or alter whitespace", () => {
    expect(hasEditorialChange("It is a color.", "It is a color.")).toBe(false);
    expect(hasEditorialChange("It is a color.", "  It is   a color.  ")).toBe(false);
  });

  it("accepts a concrete editorial replacement", () => {
    expect(hasEditorialChange("It is a color.", "It is a colour.")).toBe(true);
  });
});
