interface Env {
  TRIANGLE_REGION_ID: string;
  TRIANGLE_MODEL_ORIGIN: string;
  TRIANGLE_INFERENCE_TOKEN: string;
}
interface Data { triangleRegionId?: string; triangleUserId?: string }

function validBody(value: unknown): value is {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40) return false;
  if (body.stream !== undefined && typeof body.stream !== "boolean") return false;
  if (body.temperature !== undefined && (typeof body.temperature !== "number" || body.temperature < 0 || body.temperature > 2)) return false;
  if (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || Number(body.max_tokens) < 1 || Number(body.max_tokens) > 512)) return false;
  return body.messages.every((item) => {
    if (!item || typeof item !== "object") return false;
    const message = item as Record<string, unknown>;
    return ["system", "user", "assistant"].includes(String(message.role)) && typeof message.content === "string" && message.content.length > 0 && message.content.length <= 20_000;
  });
}

export const onRequestPost: PagesFunction<Env, string, Data> = async ({ request, env, data }) => {
  if (!data.triangleUserId || data.triangleRegionId !== env.TRIANGLE_REGION_ID) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (!env.TRIANGLE_MODEL_ORIGIN || !env.TRIANGLE_INFERENCE_TOKEN) return Response.json({ error: "Regional model service is not configured" }, { status: 503 });
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 64 * 1024) return Response.json({ error: "Request too large" }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!validBody(body)) return Response.json({ error: "Invalid chat request" }, { status: 400 });
  if (body.stream) return Response.json({ error: "Streaming is not supported by this model prototype" }, { status: 501 });

  const origin = env.TRIANGLE_MODEL_ORIGIN.replace(/\/+$/, "");
  let upstream: URL;
  try { upstream = new URL(`${origin}/v1/chat/completions`); } catch { return Response.json({ error: "Regional model service is not configured" }, { status: 503 }); }
  if (upstream.protocol !== "https:" && upstream.hostname !== "localhost" && upstream.hostname !== "127.0.0.1") {
    return Response.json({ error: "Regional model service must use HTTPS" }, { status: 503 });
  }

  const aborter = new AbortController();
  const timeout = setTimeout(() => aborter.abort(), 120_000);
  request.signal.addEventListener("abort", () => aborter.abort(), { once: true });
  try {
    const response = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.TRIANGLE_INFERENCE_TOKEN}`,
        "X-Triangle-Region": env.TRIANGLE_REGION_ID,
      },
      body: JSON.stringify({ ...body, model: "triangle-from-scratch-research-v1", stream: false }),
      signal: aborter.signal,
    });
    if (!response.ok) return Response.json({ error: "Regional model service is unavailable" }, { status: 502 });
    const payload = await response.json();
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Regional model service is unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
};
