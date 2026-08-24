import { TavilySearch } from "@langchain/tavily";
import type { ClientTool } from "@langchain/core/tools";
import env from "../utils/env.js";

const tavilySearch = new TavilySearch({
  tavilyApiKey: env.TAVILY_API_KEY,
  maxResults: 3,
});

export const tools = [
  // @langchain/tavily's schema is typed against zod/v3, which fails
  // structural typing under this project's exactOptionalPropertyTypes.
  tavilySearch as unknown as ClientTool,
];
