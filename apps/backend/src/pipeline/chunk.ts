import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 800, chunkOverlap: 100 });

// Bound how much of one page we carry forward, so one very long article
// can't dominate the chunk budget for every other source.
const MAX_CHARS_PER_SOURCE = 8000;

function cleanRawContent(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // strip markdown images
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS_PER_SOURCE);
}

export async function chunkSourceText(sourceId: number, rawContent: string): Promise<{ sourceId: number; text: string }[]> {
  const cleaned = cleanRawContent(rawContent);
  if (!cleaned) return [];

  const pieces = await splitter.splitText(cleaned);
  return pieces.map((text) => ({ sourceId, text }));
}
