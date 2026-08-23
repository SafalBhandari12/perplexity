import { createAgent } from "langchain";
import env from "./utils/env.js";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearch } from "@langchain/tavily";
import type { ClientTool } from "@langchain/core/tools";

const model = new ChatOpenAI({
  model: env.OPENAI_MODEL,
  apiKey: env.OPENAI_API_KEY,
  configuration: {
    baseURL: env.OPENAI_BASE_URL,
  },
  temperature: 0,
});

const tavilySearch = new TavilySearch({
  tavilyApiKey: env.TAVILY_API_KEY,
  maxResults: 3,
});

const agent = createAgent({
  model,
  // @langchain/tavily's schema is typed against zod/v3, which fails
  // structural typing under this project's exactOptionalPropertyTypes.
  tools: [tavilySearch as unknown as ClientTool],
});

console.log("Thinking...");

const stream = await agent.stream(
  {
    messages: [{ role: "user", content: "What happened to recent rape case in nepal?" }],
  },
  {
    streamMode: "messages",
  },
);

for await (const [message] of stream) {
  const isToolResult = message.type === "tool";

  for (const block of message.contentBlocks) {
    if (block.type === "text") {
      if (isToolResult) {
        console.log("Recieved tool result:", block.text);
        console.log("Generating answer...");
      } else {
        process.stdout.write(block.text);
      }
    }

    if (block.type === "tool_call_chunk") {
      console.log("Tool call:", block);
    }

    if (block.type === "tool_call") {
      console.log("Calling tool:", block.name);
    }
  }
}

console.log();
