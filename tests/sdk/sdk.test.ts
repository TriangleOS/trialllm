import { describe, expect, it, vi } from "vitest";
import { createTriangleClient, parseSSE, streamChat, TriangleApiError } from "../../sdk/src";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("createTriangleClient", () => {
  it("sends the bearer token and only allowed chat fields", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "1", object: "chat.completion", created: 0, model: "m", choices: [] }));
    const client = createTriangleClient({ baseUrl: "https://api.test/", getToken: async () => "tok", fetchImpl });
    await client.chat({ messages: [{ role: "user", content: "hi" }], max_tokens: 10 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toEqual({ messages: [{ role: "user", content: "hi" }], max_tokens: 10, stream: false });
  });

  it("throws 401 without calling the API when signed out", async () => {
    const fetchImpl = vi.fn();
    const client = createTriangleClient({ getToken: async () => null, fetchImpl });
    await expect(client.getRegion()).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces the gateway error and request id", async () => {
    const client = createTriangleClient({ getToken: async () => "t", fetchImpl: async () => json({ error: "This account has no access to this regional service" }, 403, { "X-Request-Id": "rid" }) });
    const err = await client.getRegion().catch((e) => e) as TriangleApiError;
    expect(err).toBeInstanceOf(TriangleApiError);
    expect(err.status).toBe(403);
    expect(err.requestId).toBe("rid");
    expect(err.message).toMatch(/regional/);
  });

  it("reports offline as status 0", async () => {
    const client = createTriangleClient({ getToken: async () => "t", fetchImpl: async () => { throw new TypeError("Network request failed"); } });
    await expect(client.listModels()).rejects.toMatchObject({ status: 0 });
  });

  it("passes an abort through as AbortError", async () => {
    const client = createTriangleClient({ getToken: async () => "t", fetchImpl: async () => { throw new DOMException("aborted", "AbortError"); } });
    await expect(client.getRegion()).rejects.toMatchObject({ name: "AbortError" });
  });
});

function sse(text: string, split = 7) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += split) c.enqueue(bytes.slice(i, i + split));
      c.close();
    },
  });
}

describe("streaming", () => {
  it("parses SSE chunks split across reads", async () => {
    const chunk = (t: string) => `data: ${JSON.stringify({ id: "1", object: "chat.completion.chunk", model: "m", choices: [{ index: 0, delta: { content: t }, finish_reason: null }] })}\n\n`;
    const out: string[] = [];
    for await (const c of parseSSE(sse(chunk("Hel") + ": comment\n\n" + chunk("lo") + "data: [DONE]\n\n"))) out.push(c.choices[0]!.delta.content!);
    expect(out.join("")).toBe("Hello");
  });

  it("surfaces the gateway's 501 until streaming exists", async () => {
    const client = createTriangleClient({ getToken: async () => "t", fetchImpl: async () => json({ error: "Streaming is not supported yet; send stream: false" }, 501) });
    const gen = streamChat(client, { messages: [{ role: "user", content: "hi" }] });
    await expect(gen.next()).rejects.toMatchObject({ status: 501 });
  });
});

describe("deleteAccount", () => {
  it("POSTs to the delete route with the user's token and no user id in the body", async () => {
    const fetchImpl = vi.fn(async () => json({ deleted: true }));
    const client = createTriangleClient({ baseUrl: "https://api.test", getToken: async () => "tok", fetchImpl });
    await client.deleteAccount();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/v1/account/delete");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
  });
});
