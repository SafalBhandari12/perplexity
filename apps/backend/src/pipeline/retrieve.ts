import { tavilySearch, tavilyExtract } from "./tavily.js";
import { chunkSourceText } from "./chunk.js";
import { embedTexts } from "./hf.js";
import type { SourceDoc, Chunk } from "./types.js";

const RESULTS_PER_QUERY = 4;
const MAX_SOURCES = 6;

export async function retrieve(queries: string[]): Promise<{ sources: SourceDoc[]; chunks: Chunk[] }> {
  const perQueryResults = await Promise.all(queries.map((q) => tavilySearch(q, RESULTS_PER_QUERY)));

  const seen = new Map<string, { url: string; title: string }>();
  for (const results of perQueryResults) {
    for (const r of results) {
      if (!seen.has(r.url)) seen.set(r.url, { url: r.url, title: r.title });
    }
  }
  const candidates = [...seen.values()].slice(0, MAX_SOURCES);

  const extracted = await tavilyExtract(candidates.map((c) => c.url));

  const sources: SourceDoc[] = [];
  const drafts: { sourceId: number; text: string }[] = [];

  let nextId = 1;
  for (const candidate of candidates) {
    const raw = extracted.get(candidate.url);
    if (!raw) continue;

    const id = nextId;
    const pieces = await chunkSourceText(id, raw);
    if (pieces.length === 0) continue;

    sources.push({ id, url: candidate.url, title: candidate.title });
    drafts.push(...pieces);
    nextId++;
  }

  if (drafts.length === 0) return { sources, chunks: [] };

  const embeddings = await embedTexts(drafts.map((d) => d.text));
  const chunks: Chunk[] = drafts.map((d, i) => ({ ...d, embedding: embeddings[i] ?? [] }));

  return { sources, chunks };
}
