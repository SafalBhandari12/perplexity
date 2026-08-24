import express from "express";
import cors from "cors";
import env from "./utils/env.js";
import { agent } from "./agent/index.js";
import { messageRequestSchema } from "./schemas/message.schema.js";
import { errorHandler } from "./middleware/errorHandler.js";

function sendEvent(res: express.Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/message", async (req, res) => {
  const { messages } = await messageRequestSchema.parseAsync(req.body);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const stream = await agent.stream({ messages }, { streamMode: "messages" });

    for await (const [message] of stream) {
      const isToolResult = message.type === "tool";

      for (const block of message.contentBlocks) {
        if (block.type === "text") {
          if (isToolResult) {
            sendEvent(res, "tool_result", { text: block.text });
          } else {
            sendEvent(res, "token", { text: block.text });
          }
        }

        if (block.type === "tool_call") {
          sendEvent(res, "tool_call", { name: block.name, args: block.args });
        }
      }
    }

    sendEvent(res, "done", {});
  } catch (err) {
    console.error(err);
    sendEvent(res, "error", { message: "Failed to generate a response." });
  } finally {
    res.end();
  }
});

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
