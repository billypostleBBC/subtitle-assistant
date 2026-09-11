---
id: compliance.bbc-subtitle-guidelines-web-editorial
type: resource
status: approved
title: BBC Subtitle Guidelines — web editorial extract
summary: Citeable, web-relevant editorial rules for subtitle proofing, with broadcast-only presentation and delivery rules kept out of the assistant prompt.
team: compliance
audience:
  - bbc_staff
  - storyworks
owner:
  name: Sarah Keating
knowledge_champion:
  name: Sarah Keating
review:
  last_reviewed: 2026-09-11
  next_review_due: 2027-03-11
  cycle_days: 181
  review_notes: Recheck the live page version and section anchors because the BBC states that it releases small updates often.
source:
  origin_type: web_page
  origin_uri: https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/
  canonical_url: https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/
  source_version: 1.2.5
  source_date: 2026-03
  extracted_at: 2026-09-11
retrieval:
  answer_mode: cite_source_section
  confidence_policy: approved_only
  priority: 80
  tags:
    - accessibility
    - subtitles
    - web-video
    - difficult-speech
    - accents
    - dialect
    - second-language-speakers
---

# BBC Subtitle Guidelines — web editorial extract

The source says that guidance without an `ONLINE` or `BROADCAST` flag applies to both platforms. The chunks below are therefore suitable for prepared web subtitles. They are concise retrieval notes, not replacements for the live source.

## Assistant-actionable guidance

### Preserve access and voice

- **2.1 Prefer verbatim:** Keep speech verbatim when it can be read in the available time. Do not remove conversational words automatically.
- **2.2 Don’t simplify:** Do not simplify language merely for deaf or hard-of-hearing viewers.
- **2.6 Preserve the style:** Preserve register, nationality, era, regional usage and context-appropriate contractions.
- **2.8 Keep the form of the verb:** Avoid changing tense or verb form; it can change meaning and create inconsistency.

### Accents, dialect and second-language speakers

- **12.1 Indicate accent only when required:** Do not label an accent by default. It must be relevant to understanding and unavailable from other context.
- **12.2 Indicate accent sparingly:** Avoid heavy phonetic spelling; it slows reading and can ridicule a speaker. Retain only readable vocabulary or construction that gives necessary flavour.
- **12.3 Incorrect grammar:** Do not correct grammar that is essential to dialect. For second-language speech, only consider a minimal edit when the meaning remains clear but the wording is genuinely difficult to read in the available time.

### Difficult or interrupted speech

- **13.1 Edit lightly:** Make the smallest change needed for intelligibility; do not turn incoherent speech into polished prose.
- **13.2 Consider the dramatic effect:** Preserve deliberate incoherence in drama.
- **13.3–13.4 Speech labels:** Preserve objective labels that explain slurred or masked speech. Avoid subjective labels such as “unintelligible”. A text-only assistant must not invent an audio condition.
- **13.7 Indicate stammer:** Show a stammer sparingly, and only where relevant.
- **14.1 Indicate hesitation only if important:** Preserve hesitation when it supports meaning, characterisation or plot. Incidental hesitation may be removed in factual content only when it impedes reading.
- **14.2 Pauses and interruptions:** Use ellipses only where the source establishes a pause, trailing-off sentence or interruption. A text-only assistant must not infer these events.

### Readability

- **3.4 Break at natural points:** Prefer punctuation and coherent phrase or clause boundaries. Avoid separating closely connected words.
- **4 Timing:** The guide recommends roughly 160–180 words per minute but treats timing as an editorial decision, not a mechanical word-count rule.

## Manual checks outside this assistant’s safe scope

The proofing request does not include audio, video frames, shot changes, speaker identity or authorial intent. The assistant must not infer accents, dialect, lip-readable words, inaudibility, pauses, interruptions, sound effects or visual obstruction. It also does not retime, merge or split cues.

For web presentation, the source recommends at most two lines for landscape/square video and three for vertical video. It defines online line length by rendered width rather than character count and warns that character limits are crude because proportional fonts vary. Browser and operating-system rendering should be tested separately.

## Excluded broadcast and delivery material

Do not feed Teletext character limits, broadcast colour/positioning conventions, live-subtitling behaviour, STL delivery, or EBU-TT contribution metadata into ordinary WebVTT editorial suggestions. Those sections address broadcast or delivery implementation rather than text proofing.
