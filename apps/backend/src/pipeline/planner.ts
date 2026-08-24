import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { model } from "../model.js";
import type { ChatMessage } from "./types.js";

const searchTool = tool(async () => "", {
  name: "search",
  description:
    "Search the web. Call this only when answering needs current or external information (facts, prices, dates, recent events, claims to verify) rather than general knowledge (definitions, math, coding help, opinions).",
  schema: z.object({
    queries: z
      .array(z.string())
      .max(4)
      .describe(
        "Up to 4 focused, non-overlapping search queries. Split a compound question into separate queries instead of one combined one. Phrase each query neutrally: do not embed a specific year, name, or outcome you're not certain is still current. Presupposing an answer in the query biases the search results right back toward that same guess — search to find the fact, not to confirm what you already believe.",
      ),
  }),
});

const plannerModel = model.bindTools([searchTool]);

export type PlanEvent = { type: "token"; text: string } | { type: "search"; queries: string[] };

// One streaming call that either answers directly (streamed as normal text,
// same cost as a plain chat completion) or emits a `search` tool call
// instead of text. Avoids paying for a separate "decide if search is
// needed" round-trip on every request just to answer questions the model
// already knows.
export async function* planOrAnswer(messages: ChatMessage[]): AsyncGenerator<PlanEvent> {
  const today = new Date().toISOString().slice(0, 10);

  const stream = await plannerModel.stream([
    {
      role: "system",
      content: `Today's date is ${today}.

Answer the user directly from your own knowledge whenever you're confident it's still accurate as of today. Call the \`search\` tool instead of answering when the question is about something that can change over time and your training data may be stale — for example: anything phrased as "current", "latest", "now", "today", "this year", or "recent"; ongoing competitions, championships, standings, or rankings; prices, scores, or statistics; recent events or news.

Do not default to the most recent instance you remember (e.g. the last championship winner you know of) when asked about the "current" one. Time may have passed since your training data was current — if you're not certain nothing has changed since then, search instead of guessing.`,
    },
    ...messages,
  ]);

  let toolName: string | undefined;
  let toolArgsJson = "";

  for await (const chunk of stream) {
    const text = chunk.content;
    if (typeof text === "string" && text) {
      yield { type: "token", text };
    }

    for (const call of chunk.tool_call_chunks ?? []) {
      if (call.name) toolName = call.name;
      if (call.args) toolArgsJson += call.args;
    }
  }

  if (toolName !== "search") return;

  try {
    const parsed = JSON.parse(toolArgsJson) as { queries?: string[] };
    yield { type: "search", queries: parsed.queries ?? [] };
  } catch (err) {
    console.error("Failed to parse search tool arguments, falling back to the raw question:", err);
    const lastMessage = messages[messages.length - 1];
    yield { type: "search", queries: lastMessage ? [lastMessage.content] : [] };
  }
}
