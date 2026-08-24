import { createAgent } from "langchain";
import { model } from "./model.js";
import { tools } from "./tools.js";

export const agent = createAgent({ model, tools });
