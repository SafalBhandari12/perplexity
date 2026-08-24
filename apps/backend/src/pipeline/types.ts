export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type SourceDoc = {
  id: number;
  url: string;
  title: string;
};

export type Chunk = {
  sourceId: number;
  text: string;
  embedding: number[];
};
