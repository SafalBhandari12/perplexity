"use client";

import { useState, type FormEvent } from "react";

type Role = "user" | "assistant";

type Message = {
  role: Role;
  content: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/message";

// Parses one `event: <type>\ndata: <json>` frame out of an SSE buffer.
function parseSseEvent(raw: string): { event: string; data: unknown } | null {
  const eventLine = raw.split("\n").find((line) => line.startsWith("event: "));
  const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
  if (!eventLine || !dataLine) return null;

  return {
    event: eventLine.slice("event: ".length),
    data: JSON.parse(dataLine.slice("data: ".length)),
  };
}

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingReply, setPendingReply] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setPendingReply("");
    setStatus("Thinking...");
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ? JSON.stringify(data.error) : `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex: number;
        while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);

          const parsed = parseSseEvent(rawEvent);
          if (!parsed) continue;

          if (parsed.event === "token") {
            const { text } = parsed.data as { text: string };
            if (text) {
              accumulated += text;
              setPendingReply(accumulated);
              setStatus(null);
            }
          } else if (parsed.event === "tool_call") {
            const { name } = parsed.data as { name: string };
            setStatus(`Calling tool: ${name}...`);
          } else if (parsed.event === "tool_result") {
            setStatus("Generating answer...");
          } else if (parsed.event === "error") {
            const { message } = parsed.data as { message: string };
            throw new Error(message);
          }
          // "done" needs no handling here; loop exits when the stream closes.
        }
      }

      setMessages([...nextMessages, { role: "assistant", content: accumulated }]);
      setPendingReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPendingReply("");
    } finally {
      setStatus(null);
      setLoading(false);
    }
  }

  return (
    <div className="chat">
      <div className="chat-header">Chat</div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <span className="message-role">{m.role === "user" ? "You:" : "Agent:"}</span>
            {m.content}
          </div>
        ))}

        {pendingReply && (
          <div className="message assistant">
            <span className="message-role">Agent:</span>
            {pendingReply}
          </div>
        )}
      </div>

      {(status || error) && (
        <div className="chat-status">{error ?? status}</div>
      )}

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
          autoFocus
        />
        <button className="chat-submit" type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
