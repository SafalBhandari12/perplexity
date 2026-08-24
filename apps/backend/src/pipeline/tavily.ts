import env from "../utils/env.js";

const BASE = "https://api.tavily.com";

export type TavilyResult = {
  url: string;
  title: string;
  content: string;
};

export async function tavilySearch(query: string, maxResults = 4): Promise<TavilyResult[]> {
  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query, max_results: maxResults }),
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed: ${res.status}`);
  }

  const data = (await res.json()) as { results: TavilyResult[] };
  return data.results;
}

export async function tavilyExtract(urls: string[]): Promise<Map<string, string>> {
  if (urls.length === 0) return new Map();

  const res = await fetch(`${BASE}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: env.TAVILY_API_KEY, urls }),
  });

  if (!res.ok) {
    throw new Error(`Tavily extract failed: ${res.status}`);
  }

  const data = (await res.json()) as { results: { url: string; raw_content: string }[] };
  return new Map(data.results.map((r) => [r.url, r.raw_content]));
}
