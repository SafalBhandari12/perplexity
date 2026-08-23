import { createAgent } from "langchain";
import "./utils/env.js";
import getWeather from "./tools/weather.js";
import { ChatOllama } from "@langchain/ollama";


const model = new ChatOllama({
  model: "gemma4:e4b",
  temperature: 0,
});

const agent = createAgent({
  model,
  tools: [getWeather],
});

const stream = await agent.stream(
  {
    messages: [{ role: "user", content: "What's the weather in Delhi?" }],
  },
  {
    streamMode: "messages",
  }
);


for await (const [message] of stream) {
  for (const block of message.contentBlocks) {
    if (block.type === "text") {
      console.log(block.text);
    }

    if (block.type === "tool_call_chunk") {
      console.log("Tool call:", block);
    }

    if (block.type === "tool_call") {
      console.log("Tool called:", block);
    }

    if (block.type === "server_tool_call_result") {
      console.log("Tool result:", block);
    }
  }
}