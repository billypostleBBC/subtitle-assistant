import JSZip from "jszip";

const WORD_SPACE = '<w:t xml:space="preserve"> </w:t>';

/**
 * Converts Word's manual layout returns to spaces before Mammoth extracts text.
 * Subtitle scripts often use these returns only to keep lines readable in Word.
 */
export function normaliseWordLayoutReturns(documentXml: string): string {
  return documentXml
    .replace(/<w:cr\b[^>]*\/>/g, WORD_SPACE)
    .replace(/<w:br\b(?![^>]*\bw:type="(?:page|column)")[^>]*\/>/g, WORD_SPACE);
}

export async function extractTranscriptText(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const document = zip.file("word/document.xml");
  if (!document) throw new Error("The Word document is missing its main document content.");

  zip.file("word/document.xml", normaliseWordLayoutReturns(await document.async("string")));
  const normalisedDocx = await zip.generateAsync({ type: "arraybuffer" });
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer: normalisedDocx });
  return result.value;
}
