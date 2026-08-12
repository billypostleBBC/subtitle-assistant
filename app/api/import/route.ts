import OpenAI from "openai";
import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  importClassificationSchema,
  reconstructSubtitleImport,
  SubtitleImportValidationError,
} from "../../../lib/import";

export const runtime = "nodejs";

const FRAME_RATE = 25;
const requestSchema = z.object({
  lines: z.array(z.object({
    id: z.string().regex(/^line-\d+$/),
    text: z.string().trim().min(1).max(10_000),
  })).min(1).max(5_000),
});

const IMPORT_INSTRUCTIONS = `You classify the source lines of a timestamped subtitle transcript. Return source line IDs only; never reproduce, correct, rewrite, merge, split, or invent any source text or timestamp.

Create one cue for every timestamp line, in the same order as the source. Each cue must contain exactly one timestampLineId and the IDs of all transcript text paragraphs belonging to that timestamp, in source order. Transcript text commonly follows its timestamp until the next timestamp, but cue numbers, titles, headings and production notes are noise rather than subtitle text. Treat any line that resembles a timestamp as a timestampLineId even when its syntax may be invalid; never discard it as noise because application code owns timestamp validation.

Put every non-cue source line in ignoredLines and classify it as cue_number, heading, production_note, or other. Literal sequential numbers adjacent to timestamps are cue_number. Every supplied line ID must appear exactly once across cues and ignoredLines. If the layout is unusual, still make the best structural classification; application code will independently validate every ID, timestamp, and ordering constraint.`;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "The transcript import service is not configured. Set OPENAI_API_KEY on the server." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The transcript import request is invalid. Upload a Word document containing no more than 5,000 non-empty lines." },
      { status: 400 },
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      temperature: 0,
      store: false,
      input: [
        { role: "system", content: IMPORT_INSTRUCTIONS },
        { role: "user", content: JSON.stringify({ lines: parsed.data.lines }) },
      ],
      text: { format: zodTextFormat(importClassificationSchema, "subtitle_import") },
    });

    const classification = response.output_parsed;
    if (!classification) {
      throw new Error("The import service did not return a structured classification.");
    }

    return NextResponse.json(reconstructSubtitleImport(parsed.data.lines, classification, FRAME_RATE));
  } catch (error) {
    if (error instanceof SubtitleImportValidationError) {
      return NextResponse.json(
        { error: `The transcript could not be imported safely. ${error.message}` },
        { status: 422 },
      );
    }
    console.error("Subtitle import failed", error);
    return NextResponse.json(
      { error: "The transcript import service could not interpret this document. Check the server configuration and try again." },
      { status: 502 },
    );
  }
}
