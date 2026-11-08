import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { chatRequestSchema, env } from "../config.js";

export const chatRouter = Router();
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Request limit reached; try again shortly" },
});

chatRouter.post("/chat/completions", limiter, async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid chat request" });

  const settings = env();
  const upstream = new URL("chat/completions", settings.modelBaseUrl.href.endsWith("/")
    ? settings.modelBaseUrl
    : `${settings.modelBaseUrl.href}/`);
  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(), 120_000);
  req.on("close", () => aborter.abort());

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.modelApiKey) headers.Authorization = `Bearer ${settings.modelApiKey}`;
    const upstreamResponse = await fetch(upstream, {
      method: "POST",
      headers,
      signal: aborter.signal,
      body: JSON.stringify({
        ...parsed.data,
        model: settings.modelId,
      }),
    });

    if (!upstreamResponse.ok) {
      // Do not leak upstream body, internal host, or key to client/logs.
      console.error(`Model service returned HTTP ${upstreamResponse.status}`);
      return res.status(502).json({ error: "Regional model service is unavailable" });
    }

    res.setHeader("Cache-Control", "no-store, no-transform");
    if (parsed.data.stream) {
      res.status(upstreamResponse.status);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Connection", "keep-alive");
      if (!upstreamResponse.body) return res.end();
      const reader = upstreamResponse.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.write(Buffer.from(value))) {
            await new Promise<void>((resolve) => res.once("drain", resolve));
          }
        }
      } finally {
        reader.releaseLock();
      }
      return res.end();
    }

    res.type("application/json");
    const data: unknown = await upstreamResponse.json();
    return res.status(200).json(data);
  } catch {
    if (res.headersSent) return res.end();
    return res.status(502).json({ error: "Regional model service is unavailable" });
  } finally {
    clearTimeout(timer);
  }
});
