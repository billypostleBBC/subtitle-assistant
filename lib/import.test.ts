import { describe, expect, it } from "vitest";
import {
  reconstructSubtitleImport,
  SubtitleImportValidationError,
  type ImportClassification,
  type ImportLine,
} from "./import";

const frameLines: ImportLine[] = [
  { id: "line-1", text: "Programme title" },
  { id: "line-2", text: "1" },
  { id: "line-3", text: "00:00:06:12 - 00:00:09:02" },
  { id: "line-4", text: "Every airline has a history." },
];

const frameClassification: ImportClassification = {
  cues: [{ timestampLineId: "line-3", textLineIds: ["line-4"] }],
  ignoredLines: [
    { lineId: "line-1", category: "heading" },
    { lineId: "line-2", category: "cue_number" },
  ],
};

describe("reconstructSubtitleImport", () => {
  it("reconstructs exact source text while removing classified noise", () => {
    expect(reconstructSubtitleImport(frameLines, frameClassification, 25)).toEqual({
      cues: [
        {
          id: "1",
          start: "00:00:06.480",
          end: "00:00:09.080",
          text: "Every airline has a history.",
        },
      ],
      ignoredLines: [
        { id: "line-1", text: "Programme title", category: "heading" },
        { id: "line-2", text: "1", category: "cue_number" },
      ],
    });
  });

  it("supports dot and comma millisecond timestamps", () => {
    const lines: ImportLine[] = [
      { id: "line-1", text: "01:00:00.760 --> 01:00:02.800" },
      { id: "line-2", text: "First cue" },
      { id: "line-3", text: "01:00:03,199 --> 01:00:05,559" },
      { id: "line-4", text: "Second cue" },
    ];
    const classification: ImportClassification = {
      cues: [
        { timestampLineId: "line-1", textLineIds: ["line-2"] },
        { timestampLineId: "line-3", textLineIds: ["line-4"] },
      ],
      ignoredLines: [],
    };

    expect(reconstructSubtitleImport(lines, classification, 25).cues).toEqual([
      { id: "1", start: "01:00:00.760", end: "01:00:02.800", text: "First cue" },
      { id: "2", start: "01:00:03.199", end: "01:00:05.559", text: "Second cue" },
    ]);
  });

  it("joins multiple source paragraphs without rewriting their content", () => {
    const lines: ImportLine[] = [
      { id: "line-1", text: "01:03:41.800 --> 01:03:46.000" },
      { id: "line-2", text: "From a simple WhatsApp group," },
      { id: "line-3", text: "it became a movement." },
    ];
    const result = reconstructSubtitleImport(lines, {
      cues: [{ timestampLineId: "line-1", textLineIds: ["line-2", "line-3"] }],
      ignoredLines: [],
    }, 25);

    expect(result.cues[0].text).toBe("From a simple WhatsApp group, it became a movement.");
  });

  it.each([
    {
      name: "duplicate references",
      classification: {
        ...frameClassification,
        ignoredLines: [...frameClassification.ignoredLines, { lineId: "line-4", category: "other" as const }],
      },
      message: "more than once",
    },
    {
      name: "fabricated references",
      classification: {
        ...frameClassification,
        ignoredLines: [...frameClassification.ignoredLines, { lineId: "line-99", category: "other" as const }],
      },
      message: "does not exist",
    },
    {
      name: "omitted references",
      classification: {
        cues: frameClassification.cues,
        ignoredLines: [{ lineId: "line-2", category: "cue_number" as const }],
      },
      message: "not classified",
    },
    {
      name: "reordered cues",
      classification: {
        cues: [
          { timestampLineId: "line-3", textLineIds: ["line-4"] },
          { timestampLineId: "line-1", textLineIds: ["line-2"] },
        ],
        ignoredLines: [],
      },
      lines: [
        { id: "line-1", text: "00:00:01.000 --> 00:00:02.000" },
        { id: "line-2", text: "First" },
        { id: "line-3", text: "00:00:03.000 --> 00:00:04.000" },
        { id: "line-4", text: "Second" },
      ],
      message: "source order",
    },
  ])("rejects $name", ({ classification, lines = frameLines, message }) => {
    expect(() => reconstructSubtitleImport(lines, classification, 25)).toThrow(message);
  });

  it("rejects empty cues and text assigned across the next timestamp", () => {
    expect(() => reconstructSubtitleImport(frameLines, {
      cues: [{ timestampLineId: "line-3", textLineIds: [] }],
      ignoredLines: [
        { lineId: "line-1", category: "heading" },
        { lineId: "line-2", category: "cue_number" },
        { lineId: "line-4", category: "other" },
      ],
    }, 25)).toThrow("at least one transcript line");

    const lines: ImportLine[] = [
      { id: "line-1", text: "00:00:01.000 --> 00:00:02.000" },
      { id: "line-2", text: "First" },
      { id: "line-3", text: "00:00:03.000 --> 00:00:04.000" },
      { id: "line-4", text: "Second" },
    ];
    expect(() => reconstructSubtitleImport(lines, {
      cues: [
        { timestampLineId: "line-1", textLineIds: ["line-4"] },
        { timestampLineId: "line-3", textLineIds: ["line-2"] },
      ],
      ignoredLines: [],
    }, 25)).toThrow(SubtitleImportValidationError);
  });

  it.each([
    ["00:00:01.000 --> 00:00:01.000", "ends before it starts"],
    ["00:00:02.000 --> 00:00:01.000", "ends before it starts"],
    ["00:00:00:25 - 00:00:01:00", "invalid at 25 fps"],
    ["00:00:60.000 --> 00:01:01.000", "not a valid timestamp"],
    ["00:00:01 --> 00:00:02", "supported timestamp"],
  ])("rejects invalid timestamp %s", (timestamp, message) => {
    const reconstruct = () => reconstructSubtitleImport([
      { id: "line-1", text: timestamp },
      { id: "line-2", text: "Text" },
    ], {
      cues: [{ timestampLineId: "line-1", textLineIds: ["line-2"] }],
      ignoredLines: [],
    }, 25);
    expect(reconstruct).toThrow(SubtitleImportValidationError);
    expect(reconstruct).toThrow(message);
  });

  it.each([
    "00:00:01.000 --> 00:00:02.000",
    "00:00:01 --> 00:00:02",
  ])("rejects an apparent timestamp classified as noise: %s", (timestamp) => {
    expect(() => reconstructSubtitleImport([
      { id: "line-1", text: timestamp },
      { id: "line-2", text: "Text" },
    ], {
      cues: [],
      ignoredLines: [
        { lineId: "line-1", category: "other" },
        { lineId: "line-2", category: "other" },
      ],
    }, 25)).toThrow("classified as noise");
  });

  it("validates ignored references even when the model returns no cues", () => {
    expect(() => reconstructSubtitleImport([
      { id: "line-1", text: "Programme title" },
    ], {
      cues: [],
      ignoredLines: [{ lineId: "line-99", category: "other" }],
    }, 25)).toThrow("does not exist");
  });

  it("enforces the 800-cue production ceiling after classification", () => {
    const cues = Array.from({ length: 801 }, (_, index) => ({
      timestampLineId: `timestamp-${index}`,
      textLineIds: [`text-${index}`],
    }));

    expect(() => reconstructSubtitleImport([
      { id: "line-1", text: "Unused because the ceiling is checked first" },
    ], { cues, ignoredLines: [] }, 25)).toThrow("maximum of 800 cues");
  });
});
