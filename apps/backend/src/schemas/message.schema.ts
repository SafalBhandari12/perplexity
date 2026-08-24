import { z } from "zod";

// The server is stateless: the client sends the full conversation on every
// request (including the newest message), so there is nothing to persist
// server-side — the message array itself *is* the memory.
export const messageRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

export type MessageRequest = z.infer<typeof messageRequestSchema>;
