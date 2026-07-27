import { z } from "zod";

export const STYLE_GUIDE_URL = "https://www.bbc.co.uk/newsstyleguide/all/";

export function styleGuideUrlFor(referenceEntry: string) {
  const initial = referenceEntry.trim().match(/[a-z]/i)?.[0]?.toLowerCase();
  return initial ? `${STYLE_GUIDE_URL}#${initial}` : STYLE_GUIDE_URL;
}

export const REVIEW_INSTRUCTIONS = `You are an editorial proofing assistant for BBC StoryWorks subtitles. Review only the text in each supplied cue. Use British English and the BBC News Style Guide where applicable. Before finalising, systematically check each cue for clear American spellings that should use their British equivalent, for example favorite to favourite and color to colour; do not change brand names, direct quotations, or intentionally American language. The supplied cue text has already converted Word layout returns into spaces. Never propose a missing-space correction merely because text may have appeared on separate lines in the original Word document. Do not change timings, merge cues, split cues, invent speaker names, or rewrite for preference. Suggest at most one comprehensive change per cue, and only when there is a clear spelling, grammar, punctuation, abbreviation, capitalisation, or BBC-style issue. Every suggestion must contain a concrete best-attempt replacement in proposedText that changes the supplied cue text. Never return an issue, reason, or style-guide citation without an actual editorial replacement. If you cannot state a specific replacement confidently, omit that cue rather than repeating its original text. Every suggestion must preserve the cue id and include a concise reason, a relevant BBC News Style Guide A-Z entry name, and exactly this canonical URL: ${STYLE_GUIDE_URL}. If no changes are necessary, return an empty suggestions array. The output is a proposal for a human owner to approve; it is not editorial approval.`;

export const reviewSchema = z.object({
  suggestions: z.array(
    z.object({
      cueId: z.string(),
      proposedText: z.string().min(1),
      reason: z.string().min(1),
      referenceEntry: z.string().min(1),
      referenceUrl: z.literal(STYLE_GUIDE_URL),
    }),
  ),
});

export type ReviewSuggestion = z.infer<typeof reviewSchema>["suggestions"][number];

export function hasEditorialChange(original: string, proposed: string) {
  const normalise = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();
  return normalise(original) !== normalise(proposed);
}
