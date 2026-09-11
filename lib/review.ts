import { z } from "zod";

export const STYLE_GUIDE_URL = "https://www.bbc.co.uk/newsstyleguide/all/";
export const BBC_SUBTITLE_GUIDE_URL = "https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/";

const SUBTITLE_GUIDE_SECTIONS: Record<string, string> = {
  "2.1 Prefer verbatim": "Prefer-verbatim",
  "2.2 Don’t simplify": "Don-t-simplify",
  "2.6 Preserve the style": "Preserve-the-style",
  "2.8 Keep the form of the verb": "Keep-the-form-of-the-verb",
  "3.4 Break at natural points": "Break-at-natural-points",
  "12.1 Indicate accent only when required": "Indicate-accent-only-when-required",
  "12.2 Indicate accent sparingly": "Indicate-accent-sparingly",
  "12.3 Incorrect grammar": "Incorrect-grammar",
  "13.1 Edit lightly": "Edit-lightly",
  "13.2 Consider the dramatic effect": "Consider-the-dramatic-effect",
  "13.3 Use labels for incoherent speech": "Use-labels-for-incoherent-speech",
  "13.4 Use labels for inaudible speech": "Use-labels-for-inaudible-speech",
  "13.7 Indicate stammer": "Indicate-stammer",
  "14.1 Indicate hesitation only if important": "Indicate-hesitation-only-if-important",
  "14.2.1 Pause within a sentence": "Pause-within-a-sentence",
  "14.2.2 Unfinished sentence": "Unfinished-sentence",
  "14.2.4 Interruption": "Interruption",
};

export type ReviewReferenceUrl = typeof STYLE_GUIDE_URL | typeof BBC_SUBTITLE_GUIDE_URL;

export function styleGuideUrlFor(referenceEntry: string) {
  const initial = referenceEntry.trim().match(/[a-z]/i)?.[0]?.toLowerCase();
  return initial ? `${STYLE_GUIDE_URL}#${initial}` : STYLE_GUIDE_URL;
}

export function referenceUrlFor(referenceUrl: ReviewReferenceUrl, referenceEntry: string) {
  if (referenceUrl === STYLE_GUIDE_URL) return styleGuideUrlFor(referenceEntry);
  const anchor = SUBTITLE_GUIDE_SECTIONS[referenceEntry.trim()];
  return anchor ? `${BBC_SUBTITLE_GUIDE_URL}#${anchor}` : BBC_SUBTITLE_GUIDE_URL;
}

export function referenceLabelFor(referenceUrl: ReviewReferenceUrl) {
  return referenceUrl === BBC_SUBTITLE_GUIDE_URL ? "BBC Subtitle Guidelines" : "BBC News Style Guide";
}

export function isSupportedReferenceUrl(referenceUrl: string): referenceUrl is ReviewReferenceUrl {
  return referenceUrl === STYLE_GUIDE_URL || referenceUrl === BBC_SUBTITLE_GUIDE_URL;
}

export function isSupportedReviewReference(referenceUrl: string, referenceEntry: string) {
  if (!isSupportedReferenceUrl(referenceUrl)) return false;
  return referenceUrl === STYLE_GUIDE_URL || Boolean(SUBTITLE_GUIDE_SECTIONS[referenceEntry.trim()]);
}

const WEB_SUBTITLE_GUIDANCE = `BBC Subtitle Guidelines (version 1.2.5, March 2026) — web-relevant editorial evidence:
- 2.1 Prefer verbatim; 2.2 Don’t simplify: preserve words, conversational flavour and audience access when the text is readable. Do not simplify merely for deaf or hard-of-hearing viewers.
- 2.6 Preserve the style; 2.8 Keep the form of the verb: preserve register, nationality, era, regional usage, contractions and verb tense. Do not silently turn a speaker's voice into standard written English.
- 12.1 Indicate accent only when required; 12.2 Indicate accent sparingly: do not label or spell out an accent unless context requires it. Avoid extensive phonetic spelling that slows reading or ridicules the speaker.
- 12.3 Incorrect grammar: do not correct grammar that is essential to dialect. For a second-language speaker, consider a light edit only when the meaning is still clear but the wording is genuinely difficult to read; otherwise preserve it for human judgement.
- 13.1 Edit lightly; 13.2 Consider the dramatic effect: difficult speech may receive the smallest change needed for intelligibility in factual content. Do not polish it into prose, and preserve deliberate incoherence in drama.
- 13.3 and 13.4: where source material already contains an objective label explaining slurred or masked speech, preserve it; avoid subjective labels such as “unintelligible”. Do not invent a label when reviewing text without audio.
- 13.7 and 14.1: represent stammers and incidental hesitation sparingly. Preserve hesitation when it matters to meaning, characterisation or plot; in factual content, an incidental “um” or “er” may be removed only when it impedes reading.
- 3.4 and 14.2: prefer natural linguistic breaks and use ellipses only for a real pause, trailing-off speech or interruption. This tool cannot see video or hear audio, so it must not infer any of those conditions.`;

export const REVIEW_INSTRUCTIONS = `You are an editorial proofing assistant for BBC StoryWorks subtitles. Review only the text in each supplied cue. Use British English, the BBC News Style Guide and the web-relevant BBC Subtitle Guidelines evidence below. Before finalising, systematically check each cue for clear American spellings that should use their British equivalent, for example favorite to favourite and color to colour; do not change brand names, direct quotations, nationality-specific wording, or intentionally American language.

${WEB_SUBTITLE_GUIDANCE}

Do not correct non-standard grammar merely because it is non-standard. It may express dialect, a second-language speaker's voice, register or characterisation. When a minimal edit is justified by the evidence above, tamper with the speaker's words as little as possible and preserve meaning, style and word order. The supplied cue text has already converted Word layout returns into spaces. Never propose a missing-space correction merely because text may have appeared on separate lines in the original Word document. Do not change timings, merge cues, split cues, invent speaker names, infer audio or visual context, or rewrite for preference.

Suggest at most one comprehensive change per cue, and only when there is a clear spelling, grammar, punctuation, abbreviation, capitalisation, BBC-style or subtitle-readability issue. Every suggestion must contain a concrete best-attempt replacement in proposedText that changes the supplied cue text. Never return an issue, reason or citation without an actual editorial replacement. If you cannot state a specific replacement confidently, omit that cue rather than repeating its original text.

Every suggestion must preserve the cue id and cite the source that directly supports that edit:
- For spelling, abbreviation and general BBC wording, give a relevant BBC News Style Guide A-Z entry name and exactly this referenceUrl: ${STYLE_GUIDE_URL}
- For subtitle-specific editing, difficult speech, accents, dialect, second-language grammar, hesitations or interruptions, give exactly one numbered section title from the evidence above and exactly this referenceUrl: ${BBC_SUBTITLE_GUIDE_URL}

If no changes are necessary, return an empty suggestions array. The output is a proposal for a human owner to approve; it is not editorial approval.`;

export const reviewSchema = z.object({
  suggestions: z.array(
    z.object({
      cueId: z.string(),
      proposedText: z.string().min(1),
      reason: z.string().min(1),
      referenceEntry: z.string().min(1),
      referenceUrl: z.enum([STYLE_GUIDE_URL, BBC_SUBTITLE_GUIDE_URL]),
    }),
  ),
});

export type ReviewSuggestion = z.infer<typeof reviewSchema>["suggestions"][number];

export function hasEditorialChange(original: string, proposed: string) {
  const normalise = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();
  return normalise(original) !== normalise(proposed);
}
