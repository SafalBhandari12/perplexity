import env from "../utils/env.js";

// api-inference.huggingface.co (the old host) no longer routes these models;
// HF now serves the serverless Inference API through router.huggingface.co.
const HF_ROUTER = "https://router.huggingface.co/hf-inference/models";
const EMBED_MODEL = "BAAI/bge-small-en-v1.5";
const RERANK_MODEL = "BAAI/bge-reranker-base";
const EMBED_BATCH_SIZE = 20;

async function hfFetch(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${HF_ROUTER}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HuggingFace request to ${path} failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    batches.push(texts.slice(i, i + EMBED_BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(
      (batch) =>
        hfFetch(`${EMBED_MODEL}/pipeline/feature-extraction`, { inputs: batch }) as Promise<number[][]>,
    ),
  );

  return results.flat();
}

type RerankResponse = [[{ label: string; score: number }]];

export async function rerank(query: string, texts: string[]): Promise<number[]> {
  return Promise.all(
    texts.map(async (text) => {
      const result = (await hfFetch(`${RERANK_MODEL}/pipeline/text-classification`, {
        inputs: [{ text: query, text_pair: text }],
      })) as RerankResponse;
      return result[0][0].score;
    }),
  );
}
