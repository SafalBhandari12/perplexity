import { ChatOpenAI } from "@langchain/openai";
import env from "./utils/env.js";

export const model = new ChatOpenAI({
  model: env.OPENAI_MODEL,
  apiKey: env.OPENAI_API_KEY,
  configuration: {
    baseURL: env.OPENAI_BASE_URL,
  },
  temperature: 0,
});
