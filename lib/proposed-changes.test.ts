import { describe, expect, it } from "vitest";
import { changedProposedSegments } from "./proposed-changes";

describe("changedProposedSegments", () => {
  it("highlights the proposed compound word when a hyphen is added", () => {
    expect(changedProposedSegments("an all time favourite", "an all-time favourite")).toEqual([
      { text: "an", changed: false },
      { text: " ", changed: false },
      { text: "all-time", changed: true },
      { text: " ", changed: false },
      { text: "favourite", changed: false },
    ]);
  });

  it("highlights changed spelling and apostrophe words, not surrounding punctuation", () => {
    expect(changedProposedSegments("It's favorite.", "It’s favourite.")).toEqual([
      { text: "It’s", changed: true },
      { text: " ", changed: false },
      { text: "favourite", changed: true },
      { text: ".", changed: false },
    ]);
  });
});
