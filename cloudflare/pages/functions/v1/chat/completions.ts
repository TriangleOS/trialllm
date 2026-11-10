import { DEFAULT_MODEL_ID, type GatewayData, type GatewayEnv } from "../../../lib/env";
import { LIMITS, validateChatBody } from "../../../lib/validate";

export const UPSTREAM_TIMEOUT_MS = 120_000;
const MAX_UPSTREAM_BYTES = 256 * 1024;

export const onRequestPost: PagesFunction<GatewayEnv, string, GatewayData> = async ({ request, env, data }) => {
  if (!data.triangleUserId || data.triangleRegionId !== env.TRIANGLE_REGION_ID) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!env.TRIANGLE_MODEL_ORIGIN || !env.TRIANGLE_INFERENCE_TOKEN) {
    return Response.json({ error: "Regional model service is not configured" }, { status: 503 });
  }

  // Read with a hard cap; Content-Length can be absent or wrong.
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > LIMITS.bodyBytes) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const result = validateChatBody(parsed);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  if (result.body.stream) {
    return Response.json({ error: "Streaming is not supported yet; send stream: false" }, { status: 501 });
  }

  let upstream: URL;
  try { upstream = new URL("/v1/chat/completions", env.TRIANGLE_MODEL_ORIGIN); } catch {
    return Response.json({ error: "Regional model service is not configured" }, { status: 503 });
  }
  if (upstream.protocol !== "https:" && upstream.hostname !== "localhost" && upstream.hostname !== "127.0.0.1") {
    return Response.json({ error: "Regional model service must use HTTPS" }, { status: 503 });
  }

  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(), UPSTREAM_TIMEOUT_MS);
  const onClientAbort = () => aborter.abort();
  request.signal?.addEventListener?.("abort", onClientAbort, { once: true });
  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.TRIANGLE_INFERENCE_TOKEN}`,
        "X-Triangle-Region": env.TRIANGLE_REGION_ID,
        ...(data.requestId ? { "X-Request-Id": data.requestId } : {}),
        ...(env.TRIANGLE_ACCESS_CLIENT_ID && env.TRIANGLE_ACCESS_CLIENT_SECRET
          ? { "CF-Access-Client-Id": env.TRIANGLE_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": env.TRIANGLE_ACCESS_CLIENT_SECRET }
          : {}),
      },
      // Only validated fields are forwarded; model and region come from deployment config.
      body: JSON.stringify({ ...result.body, model: env.TRIANGLE_PUBLIC_MODEL_ID || DEFAULT_MODEL_ID, stream: false }),
      signal: aborter.signal,
      redirect: "error",
    });
    if (!res.ok) return Response.json({ error: "Regional model service is unavailable" }, { status: 502 });
    const raw = await res.text();
    if (raw.length > MAX_UPSTREAM_BYTES) return Response.json({ error: "Regional model service is unavailable" }, { status: 502 });
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return Response.json({ error: "Regional model service is unavailable" }, { status: 502 }); }
    return Response.json(payload);
  } catch {
    return Response.json(
      { error: aborter.signal.aborted ? "Regional model service timed out" : "Regional model service is unavailable" },
      { status: aborter.signal.aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
};
