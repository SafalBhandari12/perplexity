import express from "express";
import cors from "cors";
import env from "./utils/env.js";
import { runPipeline } from "./pipeline/index.js";
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
    for await (const event of runPipeline(messages)) {
      switch (event.type) {
        case "status":
          sendEvent(res, "status", { text: event.text });
          break;
        case "sources":
          sendEvent(res, "sources", { sources: event.sources });
          break;
        case "token":
          sendEvent(res, "token", { text: event.text });
          break;
        case "follow_up":
          sendEvent(res, "follow_up", { questions: event.questions });
          break;
        case "done":
          sendEvent(res, "done", {});
          break;
      }
    }
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
