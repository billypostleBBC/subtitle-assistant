import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { extractTranscriptLines, extractTranscriptText, normaliseWordLayoutReturns, transcriptTextToImportLines } from "./docx";
import { REVIEW_INSTRUCTIONS } from "./review";
import { findOverlongCues, formatCueText, parseAlternatingTranscript, SubtitleFormatError, toWebVtt } from "./subtitles";

describe("parseAlternatingTranscript", () => {
  it("turns the Cathay-style alternating input into VTT cues", () => {
    const cues = parseAlternatingTranscript(
      "00:00:06:12 - 00:00:09:02\nEvery airline has a history.\n\n00:00:09:02 - 00:00:13:00\nBut the Cathay Pacific history, the culture that they engendered",
      25,
    );
    expect(cues).toEqual([
      { id: "1", start: "00:00:06.480", end: "00:00:09.080", text: "Every airline has a history." },
      { id: "2", start: "00:00:09.080", end: "00:00:13.000", text: "But the Cathay Pacific history, the culture that they engendered" },
    ]);
    expect(toWebVtt(cues)).toContain("WEBVTT\n\n1\n00:00:06.480 --> 00:00:09.080");
  });

  it("rejects the unsupported formats instead of guessing", () => {
    expect(() => parseAlternatingTranscript("00:00:00:00 - 00:00:01:00\nText\nUnmatched", 25)).toThrow(SubtitleFormatError);
    expect(() => parseAlternatingTranscript("Not a timestamp\nText", 25)).toThrow("Line 1 must be a timestamp");
  });

  it("parses the supplied Cathay source document", async () => {
    const source = await readFile("test/Video/Cathay/CX80A-6min-Scripts.docx");
    const cues = parseAlternatingTranscript(await extractTranscriptText(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)), 25);
    expect(cues.length).toBeGreaterThan(100);
    expect(cues[0]).toMatchObject({ start: "00:00:06.480", end: "00:00:09.080", text: "Every airline has a history." });
    expect(cues[1].text).toBe("But the Cathay Pacific history, the culture that they engendered");
    expect(toWebVtt(cues)).toMatch(/^WEBVTT\n\n1\n00:00:06\.480 --> 00:00:09\.080/m);
  });

  it("turns Word layout returns into spaces rather than concatenating words", () => {
    expect(normaliseWordLayoutReturns("<w:t>favourite,</w:t><w:cr/><w:t>please</w:t>"))
      .toBe('<w:t>favourite,</w:t><w:t xml:space="preserve"> </w:t><w:t>please</w:t>');
    expect(normaliseWordLayoutReturns("<w:t>favourite,</w:t><w:br/><w:t>please</w:t>"))
      .toBe('<w:t>favourite,</w:t><w:t xml:space="preserve"> </w:t><w:t>please</w:t>');
    expect(normaliseWordLayoutReturns("<w:br w:type=\"page\"/>"))
      .toBe('<w:br w:type="page"/>');
  });

  it("creates stable IDs for non-empty DOCX paragraphs", () => {
    expect(transcriptTextToImportLines("Heading\n\n00:00:00.000 --> 00:00:01.000\n Text ")).toEqual([
      { id: "line-1", text: "Heading" },
      { id: "line-2", text: "00:00:00.000 --> 00:00:01.000" },
      { id: "line-3", text: "Text" },
    ]);
  });

  it("extracts the supplied Cathay document as source lines", async () => {
    const source = await readFile("test/Video/Cathay/CX80A-6min-Scripts.docx");
    const lines = await extractTranscriptLines(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
    expect(lines[0]).toEqual({ id: "line-1", text: "00:00:06:12 - 00:00:09:02" });
    expect(lines[1]).toEqual({ id: "line-2", text: "Every airline has a history." });
  });

  it("wraps exported cues at word boundaries into no more than two 42-character lines", () => {
    expect(formatCueText("We use the latest technology to make travel comfortable and seamless."))
      .toBe("We use the latest technology to make\ntravel comfortable and seamless.");
    expect(toWebVtt([{ id: "1", start: "00:00:00.000", end: "00:00:04.000", text: "We use the latest technology to make travel comfortable and seamless." }]))
      .toContain("We use the latest technology to make\ntravel comfortable and seamless.");
  });

  it("flags cues that cannot fit in two lines without losing text", () => {
    const text = "This deliberately long subtitle cue contains enough separate words that it cannot fit within two conservative caption lines at all.";
    expect(findOverlongCues([{ id: "12", start: "00:00:00.000", end: "00:00:04.000", text }])).toEqual([
      { cueId: "12", lineCount: 4 },
    ]);
  });

  it("requires an explicit British-English pass and ignores Word layout returns", () => {
    expect(REVIEW_INSTRUCTIONS).toContain("favorite to favourite");
    expect(REVIEW_INSTRUCTIONS).toContain("Never propose a missing-space correction");
  });
});
