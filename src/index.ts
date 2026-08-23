import { createAgent } from "langchain";
import env from "./utils/env.js";
import getWeather from "./tools/weather.js";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: env.OPENAI_MODEL,
  apiKey: env.OPENAI_API_KEY,
  configuration: {
    baseURL: env.OPENAI_BASE_URL,
  },
  temperature: 0,
});

const agent = createAgent({
  model,
  tools: [getWeather],
});

console.log("Thinking...");

const stream = await agent.stream(
  {
    messages: [{ role: "user", content: "What's the weather in Delhi?" }],
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
