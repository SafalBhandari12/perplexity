"use client";

import { useState, type FormEvent, type ReactNode } from "react";

type Role = "user" | "assistant";

type Source = {
  id: number;
  url: string;
  title: string;
};

type Message = {
  role: Role;
  content: string;
  sources?: Source[];
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

// Splits text on [n] citation markers and turns each one into a link back
// to the matching source, so a claim in the answer stays checkable.
function renderWithCitations(text: string, sources: Source[]): ReactNode[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const parts = text.split(/(\[\d+\])/g);

  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    const source = match ? byId.get(Number(match[1])) : undefined;

    if (match && source) {
      return (
        <a
          key={i}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="citation"
          title={source.title}
        >
          {match[1]}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <div className="sources">
      {sources.map((s) => (
        <a
          key={s.id}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="source-chip"
          title={s.title}
        >
          <span className="source-chip-id">{s.id}</span>
          <span className="source-chip-title">{s.title}</span>
        </a>
      ))}
    </div>
  );
}

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingReply, setPendingReply] = useState("");
  const [pendingSources, setPendingSources] = useState<Source[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(content: string) {
    if (!content || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setPendingReply("");
    setPendingSources([]);
    setFollowUps([]);
    setStatus("Thinking...");
    setLoading(true);

    let accumulated = "";
    let sources: Source[] = [];

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ? JSON.stringify(data.error) : `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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

          if (parsed.event === "status") {
            const { text } = parsed.data as { text: string };
            setStatus(text);
          } else if (parsed.event === "sources") {
            const { sources: newSources } = parsed.data as { sources: Source[] };
            sources = newSources;
            setPendingSources(newSources);
          } else if (parsed.event === "token") {
            const { text } = parsed.data as { text: string };
            if (text) {
              accumulated += text;
              setPendingReply(accumulated);
              setStatus(null);
            }
          } else if (parsed.event === "follow_up") {
            const { questions } = parsed.data as { questions: string[] };
            setFollowUps(questions);
          } else if (parsed.event === "error") {
            const { message } = parsed.data as { message: string };
            throw new Error(message);
          }
          // "done" needs no handling here; loop exits when the stream closes.
        }
      }

      setMessages([...nextMessages, { role: "assistant", content: accumulated, sources }]);
      setPendingReply("");
      setPendingSources([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPendingReply("");
      setPendingSources([]);
    } finally {
      setStatus(null);
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input.trim());
  }

  return (
    <div className="chat">
      <div className="chat-header">Chat</div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <span className="message-role">{m.role === "user" ? "You:" : "Agent:"}</span>
            {m.role === "assistant" && m.sources ? renderWithCitations(m.content, m.sources) : m.content}
            {m.role === "assistant" && m.sources && m.sources.length > 0 && (
              <SourceList sources={m.sources} />
            )}
          </div>
        ))}

        {pendingReply && (
          <div className="message assistant">
            <span className="message-role">Agent:</span>
            {renderWithCitations(pendingReply, pendingSources)}
            {pendingSources.length > 0 && <SourceList sources={pendingSources} />}
          </div>
        )}

        {!loading && followUps.length > 0 && (
          <div className="follow-ups">
            {followUps.map((q, i) => (
              <button key={i} type="button" className="follow-up" onClick={() => sendMessage(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {(status || error) && <div className="chat-status">{error ?? status}</div>}

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
