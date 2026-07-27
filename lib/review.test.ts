import { describe, expect, it } from "vitest";
import { hasEditorialChange, STYLE_GUIDE_URL, styleGuideUrlFor } from "./review";

describe("styleGuideUrlFor", () => {
  it("links to the alphabetical section containing the referenced entry", () => {
    expect(styleGuideUrlFor("Contractions")).toBe(`${STYLE_GUIDE_URL}#c`);
    expect(styleGuideUrlFor("Foreign words and phrases")).toBe(`${STYLE_GUIDE_URL}#f`);
  });

  it("uses the canonical guide URL when an entry has no alphabetical character", () => {
    expect(styleGuideUrlFor("123")).toBe(STYLE_GUIDE_URL);
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
