export type SubtitleCue = {
  id: string;
  start: string;
  end: string;
  text: string;
};

export type OverlongCue = {
  cueId: string;
  lineCount: number;
};

export class SubtitleFormatError extends Error {}

const TIMECODE = /^(?<start>\d{2}:\d{2}:\d{2}:\d{2})(?:\s*(?:-->|[-–—])\s*|\s+)(?<end>\d{2}:\d{2}:\d{2}:\d{2})$/;
const MILLISECOND_TIMECODE = /^(?<start>\d{2}:\d{2}:\d{2}[.,]\d{3})(?:\s*(?:-->|[-–—])\s*|\s+)(?<end>\d{2}:\d{2}:\d{2}[.,]\d{3})$/;
export const MAX_CAPTION_LINE_LENGTH = 42;
export const MAX_CAPTION_LINES = 2;

export function parseAlternatingTranscript(input: string, frameRate: number): SubtitleCue[] {
  const lines = input
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) throw new SubtitleFormatError("The document does not contain any text.");
  if (lines.length % 2 !== 0) {
    throw new SubtitleFormatError(
      "Expected alternating timestamp and transcript lines. One timestamp or transcript line is unmatched.",
    );
  }

  const cues: SubtitleCue[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const match = TIMECODE.exec(lines[index]);
    if (!match?.groups) {
      throw new SubtitleFormatError(
        `Line ${index + 1} must be a timestamp in HH:MM:SS:FF - HH:MM:SS:FF format.`,
      );
    }
    if (TIMECODE.test(lines[index + 1])) {
      throw new SubtitleFormatError(`Line ${index + 2} should be transcript text, not a timestamp.`);
    }
    const start = toWebVttTime(match.groups.start, frameRate);
    const end = toWebVttTime(match.groups.end, frameRate);
    if (toMilliseconds(start) >= toMilliseconds(end)) {
      throw new SubtitleFormatError(`Cue ${cues.length + 1} ends before it starts.`);
    }
    cues.push({ id: String(cues.length + 1), start, end, text: lines[index + 1] });
  }
  return cues;
}

export function normaliseTimestampRange(input: string, frameRate: number): { start: string; end: string } {
  const frameMatch = TIMECODE.exec(input.trim());
  const millisecondMatch = MILLISECOND_TIMECODE.exec(input.trim());
  let start: string;
  let end: string;

  if (frameMatch?.groups) {
    start = toWebVttTime(frameMatch.groups.start, frameRate);
    end = toWebVttTime(frameMatch.groups.end, frameRate);
  } else if (millisecondMatch?.groups) {
    start = normaliseMillisecondTime(millisecondMatch.groups.start);
    end = normaliseMillisecondTime(millisecondMatch.groups.end);
  } else {
    throw new SubtitleFormatError(
      "Use a supported timestamp: HH:MM:SS:FF at 25 fps or HH:MM:SS.mmm. Separate the start and end with spaces, a dash, or -->.",
    );
  }

  if (toMilliseconds(start) >= toMilliseconds(end)) {
    throw new SubtitleFormatError("The timestamp ends before it starts.");
  }
  return { start, end };
}

export function toWebVtt(cues: SubtitleCue[]): string {
  if (!cues.length) throw new SubtitleFormatError("There are no cues to export.");
  return `WEBVTT\n\n${cues.map((cue) => `${cue.id}\n${cue.start} --> ${cue.end}\n${formatCueText(cue.text)}`).join("\n\n")}\n`;
}

/**
 * Creates predictable WebVTT line breaks without relying on the player's
 * viewport, font, or caption styling. The original transcript remains intact.
 */
export function formatCueText(text: string, maxLineLength = MAX_CAPTION_LINE_LENGTH): string {
  return wrapCueText(text, maxLineLength).join("\n");
}

export function findOverlongCues(cues: SubtitleCue[]): OverlongCue[] {
  return cues.flatMap((cue) => {
    const lineCount = wrapCueText(cue.text, MAX_CAPTION_LINE_LENGTH).length;
    return lineCount > MAX_CAPTION_LINES ? [{ cueId: cue.id, lineCount }] : [];
  });
}

function wrapCueText(text: string, maxLineLength: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (line && nextLine.length > maxLineLength) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  }
  lines.push(line);
  return lines;
}

function toWebVttTime(timecode: string, frameRate: number): string {
  const [hours, minutes, seconds, frames] = timecode.split(":").map(Number);
  if (frames >= frameRate) {
    throw new SubtitleFormatError(`${timecode} uses frame ${frames}; it is invalid at ${frameRate} fps.`);
  }
  if (minutes > 59 || seconds > 59) throw new SubtitleFormatError(`${timecode} is not a valid timecode.`);
  const milliseconds = Math.round((frames / frameRate) * 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${String(milliseconds).padStart(3, "0")}`;
}

function normaliseMillisecondTime(timecode: string): string {
  const canonical = timecode.replace(",", ".");
  const [hms] = canonical.split(".");
  const [, minutes, seconds] = hms.split(":").map(Number);
  if (minutes > 59 || seconds > 59) {
    throw new SubtitleFormatError(`${timecode} is not a valid timestamp.`);
  }
  return canonical;
}

function toMilliseconds(time: string): number {
  const [hms, ms] = time.split(".");
  const [hours, minutes, seconds] = hms.split(":").map(Number);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + Number(ms);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
