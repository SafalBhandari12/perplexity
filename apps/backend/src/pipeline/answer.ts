import { model } from "../model.js";
import type { ChatMessage, Chunk, SourceDoc } from "./types.js";

function buildContext(sources: SourceDoc[], chunks: Chunk[]): string {
  return sources
    .map((s) => {
      const text = chunks
        .filter((c) => c.sourceId === s.id)
        .map((c) => c.text)
        .join("\n...\n");
      return `[${s.id}] (${s.url})\n${text}`;
    })
    .join("\n\n");
}

export type AnswerEvent = { type: "token"; text: string } | { type: "follow_up"; questions: string[] };

const FOLLOWUP_DELIMITER = "\n===FOLLOWUP===\n";

export async function* streamAnswer(
  messages: ChatMessage[],
  sources: SourceDoc[],
  chunks: Chunk[],
): AsyncGenerator<AnswerEvent> {
  const context = sources.length > 0 ? buildContext(sources, chunks) : null;
  const today = new Date().toISOString().slice(0, 10);

  // Follow-ups only make sense once there's grounded context to suggest
  // next questions about — asking for them here (same call, same context
  // already in the prompt) avoids a second round-trip that would just
  // re-send the whole conversation and answer as input tokens again.
  const followUpInstruction = context
    ? `\n\nAfter you finish answering, on its own line write exactly ${FOLLOWUP_DELIMITER.trim()} then list exactly 3 short, natural follow-up questions the user might ask next, one per line, nothing else after them.`
    : "";

  const systemPrompt = context
    ? `Today's date is ${today}. Answer the user's question using ONLY the numbered sources below. Cite every factual claim inline with the matching [n]. If the sources don't fully cover the question, say so instead of guessing.\n\n${context}${followUpInstruction}`
    : `Today's date is ${today}. Answer the user's question directly and concisely, using your own knowledge.`;

  const stream = await model.stream([{ role: "system", content: systemPrompt }, ...messages]);

  let buffer = "";
  let inFollowUps = false;
  let followUpText = "";

  for await (const part of stream) {
    const text = part.content;
    if (typeof text !== "string" || !text) continue;

    if (inFollowUps) {
      followUpText += text;
      continue;
    }

    buffer += text;
    const delimIndex = buffer.indexOf(FOLLOWUP_DELIMITER);

    if (delimIndex !== -1) {
      const before = buffer.slice(0, delimIndex);
      if (before) yield { type: "token", text: before };
      inFollowUps = true;
      followUpText = buffer.slice(delimIndex + FOLLOWUP_DELIMITER.length);
      buffer = "";
      continue;
    }

    // Hold back a tail as long as the delimiter minus one char — it might
    // be the start of the delimiter — so it never leaks into the visible
    // answer. Everything before that is safe to flush immediately.
    const holdBack = Math.min(buffer.length, FOLLOWUP_DELIMITER.length - 1);
    const safe = buffer.slice(0, buffer.length - holdBack);
    if (safe) {
      yield { type: "token", text: safe };
      buffer = buffer.slice(safe.length);
    }
  }

  if (!inFollowUps && buffer) {
    yield { type: "token", text: buffer };
  }

  if (inFollowUps) {
    const questions = followUpText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (questions.length > 0) {
      yield { type: "follow_up", questions };
    }
  }
}
