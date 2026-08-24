import { embedTexts, rerank as hfRerank } from "./hf.js";
import type { Chunk } from "./types.js";

const TOP_K = 12;
const FINAL_N = 6;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function rankChunks(query: string, chunks: Chunk[]): Promise<Chunk[]> {
  if (chunks.length === 0) return [];

  const [queryEmbedding] = await embedTexts([query]);
  if (!queryEmbedding) return chunks.slice(0, FINAL_N);

  const topByEmbedding = chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map((x) => x.chunk);

  try {
    const scores = await hfRerank(
      query,
      topByEmbedding.map((c) => c.text),
    );

    return topByEmbedding
      .map((chunk, i) => ({ chunk, score: scores[i] ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, FINAL_N)
      .map((x) => x.chunk);
  } catch (err) {
    // Reranker unavailable (cold start / rate limit) — fall back to the
    // embedding-similarity order rather than failing the whole answer.
    console.error("Rerank failed, falling back to similarity order:", err);
    return topByEmbedding.slice(0, FINAL_N);
  }
}
