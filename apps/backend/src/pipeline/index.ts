import { planOrAnswer } from "./planner.js";
import { retrieve } from "./retrieve.js";
import { rankChunks } from "./rank.js";
import { streamAnswer } from "./answer.js";
import type { ChatMessage, Chunk, SourceDoc } from "./types.js";

export type PipelineEvent =
  | { type: "status"; text: string }
  | { type: "sources"; sources: SourceDoc[] }
  | { type: "token"; text: string }
  | { type: "follow_up"; questions: string[] }
  | { type: "done" };

export async function* runPipeline(
  messages: ChatMessage[],
): AsyncGenerator<PipelineEvent> {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    yield { type: "done" };
    return;
  }

  yield { type: "status", text: "Thinking..." };

  // A single call either streams a direct answer (no search needed — no
  // extra round-trip beyond a normal chat completion) or resolves to a
  // list of search queries. Only the search path costs a further call,
  // because only it has evidence left to generate an answer from.
  let queries: string[] | null = null;
  for await (const event of planOrAnswer(messages)) {
    if (event.type === "token") {
      yield { type: "token", text: event.text };
    } else {
      queries = event.queries;
    }
  }

  if (!queries || queries.length === 0) {
    yield { type: "done" };
    return;
  }

  yield { type: "status", text: `Searching: ${queries.join(" · ")}` };

  let sources: SourceDoc[] = [];
  let topChunks: Chunk[] = [];
  try {
    const retrieved = await retrieve(queries);
    sources = retrieved.sources;

    yield { type: "status", text: "Ranking evidence..." };
    topChunks = await rankChunks(lastMessage.content, retrieved.chunks);
  } catch (err) {
    console.error("Retrieval failed, falling back to a direct answer:", err);
    sources = [];
    topChunks = [];
  }

  if (sources.length > 0) {
    yield { type: "sources", sources };
  }

  yield { type: "status", text: "Writing answer..." };

  for await (const event of streamAnswer(messages, sources, topChunks)) {
    if (event.type === "token") {
      yield { type: "token", text: event.text };
    } else {
      yield { type: "follow_up", questions: event.questions };
    }
  }

  yield { type: "done" };
}
