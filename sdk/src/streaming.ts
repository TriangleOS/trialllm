import { errorFrom, TriangleApiError, type TriangleClient } from "./client";
import type { ChatChunk, ChatRequest } from "./types";

/**
 * Parses an OpenAI-style server-sent-events body into chunks.
 * Ready for when the model service streams tokens. Today the gateway answers
 * `stream: true` with HTTP 501, which streamChat surfaces as TriangleApiError(501).
 */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      if (done) buffer += decoder.decode() + "\n\n";
      let idx: number;
      while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const event = buffer.slice(0, idx);
        buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (!data) continue;
        if (data === "[DONE]") return;
        yield JSON.parse(data) as ChatChunk;
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* streamChat(client: TriangleClient, req: ChatRequest, signal?: AbortSignal): AsyncGenerator<string> {
  const res = await client.fetch(`${client.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { ...(await client.authHeaders()), "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ messages: req.messages, temperature: req.temperature, max_tokens: req.max_tokens, stream: true }),
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new TriangleApiError(502, "Streaming response had no body.");
  for await (const chunk of parseSSE(res.body)) {
    const piece = chunk.choices[0]?.delta?.content;
    if (piece) yield piece;
  }
}
