import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyAccessToken } from "../../cloudflare/pages/lib/auth";
import { validateChatBody } from "../../cloudflare/pages/lib/validate";
import { onRequestGet as region } from "../../cloudflare/pages/functions/v1/region";
import { onRequestGet as models } from "../../cloudflare/pages/functions/v1/models";
import { onRequestPost as chat } from "../../cloudflare/pages/functions/v1/chat/completions";
import { onRequestPost as del } from "../../cloudflare/pages/functions/v1/account/delete";
import { hsToken, ISSUER, runPages, testEnv } from "./helpers";

const URL_BASE = "https://llm.triangleos.com";
const regionClaim = { app_metadata: { triangle_region_id: "uk-1" } };

function req(path: string, init: RequestInit & { token?: string; origin?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.origin) headers.set("Origin", init.origin);
  return new Request(`${URL_BASE}${path}`, { ...init, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe("auth and region", () => {
  it("rejects a missing token with 401", async () => {
    const res = await runPages(req("/v1/region"), testEnv(), region);
    expect(res.status).toBe(401);
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("rejects a token signed with the wrong key", async () => {
    const token = await hsToken(regionClaim, { secret: "another-secret-another-secret-another-secret" });
    expect((await runPages(req("/v1/region", { token }), testEnv(), region)).status).toBe(401);
  });

  it("rejects wrong issuer, wrong audience and expired tokens", async () => {
    for (const opts of [{ iss: "https://evil.example/auth/v1" }, { aud: "anon" }, { exp: Math.floor(Date.now() / 1000) - 60 }]) {
      const token = await hsToken(regionClaim, opts);
      expect((await runPages(req("/v1/region", { token }), testEnv(), region)).status).toBe(401);
    }
  });

  it("rejects a token without a subject", async () => {
    const token = await hsToken(regionClaim, { sub: null });
    expect((await runPages(req("/v1/region", { token }), testEnv(), region)).status).toBe(401);
  });

  it("returns 403 when the region claim is missing", async () => {
    const token = await hsToken({});
    expect((await runPages(req("/v1/region", { token }), testEnv(), region)).status).toBe(403);
  });

  it("returns 403 for a different region (no cross-region access)", async () => {
    const token = await hsToken({ app_metadata: { triangle_region_id: "za-1" } });
    expect((await runPages(req("/v1/region", { token }), testEnv(), region)).status).toBe(403);
  });

  it("ignores a region the user put in their own user_metadata", async () => {
    const token = await hsToken({ user_metadata: { triangle_region_id: "uk-1" } });
    expect((await runPages(req("/v1/region", { token }), testEnv(), region)).status).toBe(403);
  });

  it("accepts a valid token with the region in app_metadata", async () => {
    const token = await hsToken(regionClaim);
    const res = await runPages(req("/v1/region", { token }), testEnv(), region);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ regionId: "uk-1", assignedTo: "user-123" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("accepts a top-level triangle_region_id claim", async () => {
    const token = await hsToken({ triangle_region_id: "uk-1" });
    expect((await runPages(req("/v1/region", { token }), testEnv(), region)).status).toBe(200);
  });

  it("verifies ES256 tokens against a JWKS", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256" };
    const token = await new SignJWT(regionClaim).setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setIssuer(ISSUER).setAudience("authenticated").setSubject("u1").setExpirationTime("5m").sign(privateKey);
    const result = await verifyAccessToken(`Bearer ${token}`, testEnv({ SUPABASE_JWT_SECRET: undefined }), {
      kind: "jwks", getKey: createLocalJWKSet({ keys: [jwk] }),
    });
    expect(result).toEqual({ ok: true, sub: "u1", regionId: "uk-1" });
  });

  it("rejects an HS256 token when only a JWKS is configured (algorithm confusion)", async () => {
    const { publicKey } = await generateKeyPair("ES256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256" };
    const token = await hsToken(regionClaim);
    const result = await verifyAccessToken(`Bearer ${token}`, testEnv(), { kind: "jwks", getKey: createLocalJWKSet({ keys: [jwk] }) });
    expect(result.ok).toBe(false);
  });

  it("returns 503 when no key source is configured", async () => {
    const token = await hsToken(regionClaim);
    const res = await runPages(req("/v1/region", { token }), testEnv({ SUPABASE_JWT_SECRET: undefined }), region);
    expect(res.status).toBe(503);
  });
});

describe("CORS and origins", () => {
  it("answers preflight for an allowed origin", async () => {
    const res = await runPages(req("/v1/chat/completions", { method: "OPTIONS", origin: "https://app.triangleos.com" }), testEnv(), chat);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.triangleos.com");
  });

  it("rejects a foreign origin with 403 and no allow-origin header", async () => {
    const token = await hsToken(regionClaim);
    const res = await runPages(req("/v1/region", { token, origin: "https://evil.example" }), testEnv(), region);
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("does not touch non-API paths", async () => {
    const res = await runPages(req("/index.html"), testEnv(), () => new Response("site"));
    expect(await res.text()).toBe("site");
  });
});

describe("request validation", () => {
  const ok = { messages: [{ role: "user", content: "hi" }] };
  it("accepts a minimal body", () => expect(validateChatBody(ok).ok).toBe(true));
  it.each([
    ["client model override", { ...ok, model: "gpt-x" }],
    ["client region override", { ...ok, region: "za-1" }],
    ["client upstream url", { ...ok, url: "https://evil.example" }],
    ["client api key", { ...ok, api_key: "x" }],
    ["extra message field", { messages: [{ role: "user", content: "hi", name: "x" }] }],
    ["bad role", { messages: [{ role: "tool", content: "hi" }] }],
    ["empty messages", { messages: [] }],
    ["too many messages", { messages: Array.from({ length: 41 }, () => ({ role: "user", content: "x" })) }],
    ["temperature too high", { ...ok, temperature: 3 }],
    ["max_tokens too high", { ...ok, max_tokens: 10_000 }],
    ["array body", [ok]],
  ])("rejects %s", (_name, body) => expect(validateChatBody(body).ok).toBe(false));
});

describe("chat proxy", () => {
  async function post(body: unknown, env = testEnv()) {
    const token = await hsToken(regionClaim);
    return runPages(req("/v1/chat/completions", { method: "POST", token, body: JSON.stringify(body) }), env, chat);
  }
  const body = { messages: [{ role: "user", content: "hello" }], temperature: 0.5 };

  it("forwards only validated fields with server-side model, region and token", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "x", object: "chat.completion", choices: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await post(body);
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://inference.example.test/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer service-token-service-token-service-token");
    expect(headers["X-Triangle-Region"]).toBe("uk-1");
    expect(JSON.parse(init.body as string)).toEqual({ ...body, model: "triangle-from-scratch-research-v1", stream: false });
  });

  it("never forwards the user's JWT upstream", async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    await post(body);
    const init = (fetchMock.mock.calls[0] as unknown as [URL, RequestInit])[1];
    expect(JSON.stringify(init)).not.toContain("user-123");
  });

  it("returns 501 for stream: true", async () => {
    expect((await post({ ...body, stream: true })).status).toBe(501);
  });

  it("returns 400 for a client model override", async () => {
    expect((await post({ ...body, model: "other" })).status).toBe(400);
  });

  it("returns 413 for an oversized body", async () => {
    expect((await post({ messages: [{ role: "user", content: "x".repeat(70_000) }] })).status).toBe(413);
  });

  it("returns 502 when the model service errors and does not leak details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("stack trace secret", { status: 500 })));
    const res = await post(body);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret");
  });

  it("returns 504 when the model service times out", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_u: URL, init: RequestInit) => new Promise((_r, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const pending = post(body);
    await vi.advanceTimersByTimeAsync(121_000);
    const res = await pending;
    vi.useRealTimers();
    expect(res.status).toBe(504);
  });

  it("returns 503 when the model service is not configured (no fallback)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await post(body, testEnv({ TRIANGLE_MODEL_ORIGIN: undefined }))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a plain-http model origin", async () => {
    expect((await post(body, testEnv({ TRIANGLE_MODEL_ORIGIN: "http://inference.example.test" }))).status).toBe(503);
  });
});

describe("models", () => {
  it("lists the configured model with an honest notice", async () => {
    const token = await hsToken(regionClaim);
    const res = await runPages(req("/v1/models", { token }), testEnv(), models);
    const json = await res.json() as { data: Array<{ id: string; tier: string; notice: string }> };
    expect(json.data[0]?.id).toBe("triangle-from-scratch-research-v1");
    expect(json.data[0]?.tier).toBe("research-preview");
    expect(json.data[0]?.notice).toMatch(/Research prototype/);
  });
});

describe("account deletion", () => {
  const env = testEnv({ SUPABASE_URL: "https://example-ref.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" });

  it("deletes only the token's own user, even without a region", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const token = await hsToken({}, { sub: "user-9" });
    const res = await runPages(req("/v1/account/delete", { method: "POST", token, body: JSON.stringify({ sub: "someone-else" }) }), env, del);
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://example-ref.supabase.co/auth/v1/admin/users/user-9");
    expect(init.method).toBe("DELETE");
  });

  it("requires a valid token", async () => {
    expect((await runPages(req("/v1/account/delete", { method: "POST" }), env, del)).status).toBe(401);
  });

  it("still applies the region check to other routes for unassigned users", async () => {
    const token = await hsToken({});
    expect((await runPages(req("/v1/region", { token }), env, region)).status).toBe(403);
  });

  it("returns a safe error when Supabase refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("fk violation detail", { status: 500 })));
    const token = await hsToken(regionClaim);
    const res = await runPages(req("/v1/account/delete", { method: "POST", token }), env, del);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("fk violation");
  });

  it("returns 503 when not configured", async () => {
    const token = await hsToken(regionClaim);
    expect((await runPages(req("/v1/account/delete", { method: "POST", token }), testEnv(), del)).status).toBe(503);
  });
});
