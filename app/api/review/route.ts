import OpenAI from "openai";
import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { hasEditorialChange, isSupportedReviewReference, REVIEW_INSTRUCTIONS, reviewSchema } from "../../../lib/review";

// OpenNext runs Next.js's Node runtime on Cloudflare Workers. Its separate
// Next.js Edge runtime is not supported by the Webflow Cloud adapter.
export const runtime = "nodejs";

const requestSchema = z.object({
  cues: z.array(z.object({ id: z.string(), text: z.string().min(1) })).min(1).max(800),
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "The proofing service is not configured. Set OPENAI_API_KEY on the server." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "The review request is invalid." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      temperature: 0,
      input: [
        {
          role: "system",
          content: REVIEW_INSTRUCTIONS,
        },
        { role: "user", content: JSON.stringify({ cues: parsed.data.cues }) },
      ],
      text: { format: zodTextFormat(reviewSchema, "subtitle_review") },
    });

    const output = response.output_parsed;
    if (!output) throw new Error("The proofing service did not return a structured review.");
    const cueTextById = new Map(parsed.data.cues.map((cue) => [cue.id, cue.text]));
    const seenCueIds = new Set<string>();
    const safeSuggestions = output.suggestions.filter((suggestion) => {
      const originalText = cueTextById.get(suggestion.cueId);
      if (!originalText || !isSupportedReviewReference(suggestion.referenceUrl, suggestion.referenceEntry) || seenCueIds.has(suggestion.cueId) || !hasEditorialChange(originalText, suggestion.proposedText)) return false;
      seenCueIds.add(suggestion.cueId);
      return true;
    });
    return NextResponse.json({ suggestions: safeSuggestions });
  } catch (error) {
    console.error("Subtitle review failed", error);
    return NextResponse.json({ error: "Proofing could not be completed. Check the server configuration and try again." }, { status: 502 });
  }
}
