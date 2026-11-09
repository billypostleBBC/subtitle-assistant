import { BBC_SUBTITLE_GUIDE_URL, type ReviewFinding } from "./review";
import type { SubtitleCue } from "./subtitles";

// Invented, fixed review data for the development-only interaction preview.
export const reviewDemo: { cues: SubtitleCue[]; findings: ReviewFinding[] } = {
  cues: [
    { id: "1", start: "00:00:01.000", end: "00:00:04.000", text: "I learnt this during a workshop," },
    { id: "2", start: "00:00:04.000", end: "00:00:07.000", text: "It changed how I plan my day." },
    { id: "3", start: "00:00:07.000", end: "00:00:10.000", text: "My work depends on one habit." },
    { id: "4", start: "00:00:10.000", end: "00:00:13.000", text: "Writing a short note every morning." },
    { id: "5", start: "00:00:13.000", end: "00:00:15.000", text: "I sometimes stop..." },
    { id: "6", start: "00:00:15.000", end: "00:00:18.000", text: "and think about what matters." },
  ],
  findings: [
    { kind: "edit", cues: [{ cueId: "1", proposedText: "I learnt this during a workshop." }], reason: "The following cue starts a new sentence. A full stop replaces the trailing comma.", question: null, referenceEntry: "3.4 Break at natural points", referenceUrl: BBC_SUBTITLE_GUIDE_URL },
    { kind: "edit", cues: [{ cueId: "3", proposedText: "My work depends on one habit:" }, { cueId: "4", proposedText: "writing a short note every morning." }], reason: "The second cue explains the habit. A colon and lowercase continuation connect the explanation.", question: null, referenceEntry: "3.4 Break at natural points", referenceUrl: BBC_SUBTITLE_GUIDE_URL },
    { kind: "audio_check", cues: [{ cueId: "5", proposedText: null }, { cueId: "6", proposedText: null }], reason: "The ellipsis might mark a meaningful pause or simply a subtitle boundary.", question: "Listen to the transition after ‘stop’. Is there a meaningful pause? Keep the ellipsis if there is; otherwise remove it and check the continuation.", referenceEntry: "14.2.1 Pause within a sentence", referenceUrl: BBC_SUBTITLE_GUIDE_URL },
  ],
};
