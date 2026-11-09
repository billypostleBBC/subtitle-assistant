import OpenAI from "openai";
import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import { REVIEW_INSTRUCTIONS, reviewModelOptions, reviewRequestSchema, reviewSchema, validateReview } from "../../../lib/review";

// OpenNext runs Next.js's Node runtime on Cloudflare Workers. Its separate
// Next.js Edge runtime is not supported by the Webflow Cloud adapter.
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "The proofing service is not configured. Set OPENAI_API_KEY on the server." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "The review request is invalid. Use unique cue IDs, up to 800 cues and no more than 80,000 text characters." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 25_000, maxRetries: 0 });
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  try {
    const response = await client.responses.parse({
      model,
      ...reviewModelOptions(model),
      store: false,
      max_output_tokens: 12_000,
      input: [
        {
          role: "system",
          content: REVIEW_INSTRUCTIONS,
        },
        { role: "user", content: JSON.stringify({ cues: parsed.data.cues }) },
      ],
      text: { format: zodTextFormat(reviewSchema, "subtitle_review") },
    });

    if (response.output.some((item) => item.type === "message" && item.content.some((content) => content.type === "refusal"))) {
      return NextResponse.json({ error: "The proofing service declined this review. Use a manual review for this transcript." }, { status: 422 });
    }
    if (response.status !== "completed") {
      return NextResponse.json({ error: "The proofing service did not finish the review. Try a shorter transcript or review it manually." }, { status: 502 });
    }
    try {
      return NextResponse.json(validateReview(response.output_parsed, parsed.data.cues));
    } catch {
      return NextResponse.json({ error: "The review could not be validated. No partial results were applied. Please try again or review the transcript manually." }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
      return NextResponse.json({ error: "Proofing timed out. Try again or use a shorter transcript." }, { status: 504 });
    }
    if (typeof error === "object" && error !== null && "status" in error && error.status === 429) {
      return NextResponse.json({ error: "The proofing service is busy. Wait a moment, then try again." }, { status: 429 });
    }
    return NextResponse.json({ error: "Proofing could not be completed. Please try again; if it continues, contact the tool owner." }, { status: 502 });
  }
}
