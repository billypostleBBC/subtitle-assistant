import { z } from "zod";
import { normaliseTimestampRange, SubtitleCue, SubtitleFormatError } from "./subtitles";

export const noiseCategories = ["cue_number", "heading", "production_note", "other"] as const;
export type NoiseCategory = typeof noiseCategories[number];

export type ImportLine = {
  id: string;
  text: string;
};

export type IgnoredImportLine = ImportLine & {
  category: NoiseCategory;
};

export type SubtitleImportResult = {
  cues: SubtitleCue[];
  ignoredLines: IgnoredImportLine[];
};

export const importClassificationSchema = z.object({
  cues: z.array(z.object({
    timestampLineId: z.string().min(1),
    textLineIds: z.array(z.string().min(1)),
  })),
  ignoredLines: z.array(z.object({
    lineId: z.string().min(1),
    category: z.enum(noiseCategories),
  })),
});

export type ImportClassification = z.infer<typeof importClassificationSchema>;

export class SubtitleImportValidationError extends SubtitleFormatError {}

const APPARENT_TIMESTAMP = /\d{2}:\d{2}:\d{2}(?::\d{1,2}|[.,]\d{1,3})?\s*(?:-->|-)\s*\d{2}:\d{2}:\d{2}/;

export function reconstructSubtitleImport(
  lines: ImportLine[],
  classification: ImportClassification,
  frameRate: number,
): SubtitleImportResult {
  if (!lines.length) {
    throw new SubtitleImportValidationError("The document does not contain any text.");
  }
  if (classification.cues.length > 800) {
    throw new SubtitleImportValidationError("The document contains more than the supported maximum of 800 cues.");
  }

  const lineById = new Map<string, ImportLine>();
  const indexById = new Map<string, number>();
  for (const [index, line] of lines.entries()) {
    if (!line.id || !line.text.trim()) {
      throw new SubtitleImportValidationError("Every source line must have a stable ID and non-empty text.");
    }
    if (lineById.has(line.id)) {
      throw new SubtitleImportValidationError(`Source line ${line.id} appears more than once.`);
    }
    lineById.set(line.id, line);
    indexById.set(line.id, index);
  }

  const usedLineIds = new Set<string>();
  const claimLine = (lineId: string) => {
    if (!lineById.has(lineId)) {
      throw new SubtitleImportValidationError(`The import referenced ${lineId}, which does not exist in the document.`);
    }
    if (usedLineIds.has(lineId)) {
      throw new SubtitleImportValidationError(`Source line ${lineId} was classified more than once.`);
    }
    usedLineIds.add(lineId);
  };

  const timestampIndexes = classification.cues.map((cue, cueIndex) => {
    if (!cue.textLineIds.length) {
      throw new SubtitleImportValidationError(`Cue ${cueIndex + 1} must contain at least one transcript line.`);
    }
    claimLine(cue.timestampLineId);
    return indexById.get(cue.timestampLineId)!;
  });

  for (let cueIndex = 1; cueIndex < timestampIndexes.length; cueIndex += 1) {
    if (timestampIndexes[cueIndex] <= timestampIndexes[cueIndex - 1]) {
      throw new SubtitleImportValidationError("The model returned cues outside their source order.");
    }
  }

  const cues = classification.cues.map((cue, cueIndex): SubtitleCue => {
    const timestampIndex = timestampIndexes[cueIndex];
    const nextTimestampIndex = timestampIndexes[cueIndex + 1] ?? lines.length;
    let previousTextIndex = timestampIndex;

    const text = cue.textLineIds.map((lineId) => {
      claimLine(lineId);
      const textIndex = indexById.get(lineId)!;
      if (textIndex <= previousTextIndex || textIndex >= nextTimestampIndex) {
        throw new SubtitleImportValidationError(`Cue ${cueIndex + 1} contains transcript lines outside their source order.`);
      }
      previousTextIndex = textIndex;
      const line = lineById.get(lineId)!;
      if (APPARENT_TIMESTAMP.test(line.text)) {
        throw new SubtitleImportValidationError(`Line ${line.id} looks like a timestamp but was classified as transcript text.`);
      }
      return line.text;
    }).join(" ");

    const timestampLine = lineById.get(cue.timestampLineId)!;
    let start: string;
    let end: string;
    try {
      ({ start, end } = normaliseTimestampRange(timestampLine.text, frameRate));
    } catch (error) {
      if (error instanceof SubtitleFormatError) {
        throw new SubtitleImportValidationError(`Cue ${cueIndex + 1}: ${error.message}`);
      }
      throw error;
    }
    return { id: String(cueIndex + 1), start, end, text };
  });

  const ignoredCategoryById = new Map<string, NoiseCategory>();
  for (const ignored of classification.ignoredLines) {
    claimLine(ignored.lineId);
    const line = lineById.get(ignored.lineId)!;
    if (APPARENT_TIMESTAMP.test(line.text)) {
      throw new SubtitleImportValidationError(`Line ${line.id} looks like a timestamp but was classified as noise.`);
    }
    ignoredCategoryById.set(ignored.lineId, ignored.category);
  }

  const unclassified = lines.filter((line) => !usedLineIds.has(line.id));
  if (unclassified.length) {
    throw new SubtitleImportValidationError(
      `${unclassified.length} source line${unclassified.length === 1 ? " was" : "s were"} not classified: ${unclassified.slice(0, 5).map((line) => line.id).join(", ")}.`,
    );
  }
  if (!cues.length) {
    throw new SubtitleImportValidationError("The document does not contain any timestamped subtitle cues.");
  }

  const ignoredLines = lines.flatMap((line): IgnoredImportLine[] => {
    const category = ignoredCategoryById.get(line.id);
    return category ? [{ ...line, category }] : [];
  });

  return { cues, ignoredLines };
}
