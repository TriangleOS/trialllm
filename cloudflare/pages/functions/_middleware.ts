import { createRemoteJWKSet, jwtVerify } from "jose";

interface Env {
  OIDC_ISSUER: string;
  OIDC_AUDIENCE: string;
  OIDC_JWKS_URL: string;
  TRIANGLE_REGION_ID: string;
  TRIANGLE_ALLOWED_ORIGINS: string;
  TRIANGLE_MODEL_ORIGIN: string;
  TRIANGLE_INFERENCE_TOKEN: string;
}

let cachedJwksUrl = "";
let remoteKeys: ReturnType<typeof createRemoteJWKSet> | undefined;

function allowedOrigins(env: Env): Set<string> {
  return new Set(env.TRIANGLE_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean));
}

function corsHeaders(origin: string | null, env: Env): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin && allowedOrigins(env).has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next, data } = context;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/v1/")) return next();

  const origin = request.headers.get("Origin");
  const headers = corsHeaders(origin, env);
  if (origin && !allowedOrigins(env).has(origin)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  if (!env.OIDC_ISSUER || !env.OIDC_AUDIENCE || !env.OIDC_JWKS_URL || !env.TRIANGLE_REGION_ID) {
    return Response.json({ error: "Regional API is not configured" }, { status: 503, headers });
  }
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) return Response.json({ error: "Authentication required" }, { status: 401, headers });

  try {
    if (cachedJwksUrl !== env.OIDC_JWKS_URL) {
      cachedJwksUrl = env.OIDC_JWKS_URL;
      remoteKeys = createRemoteJWKSet(new URL(cachedJwksUrl));
    }
    const { payload } = await jwtVerify(match[1], remoteKeys!, {
      issuer: env.OIDC_ISSUER,
      audience: env.OIDC_AUDIENCE,
      algorithms: ["RS256", "ES256"],
    });
    if (typeof payload.sub !== "string" || payload.triangle_region_id !== env.TRIANGLE_REGION_ID) {
      return Response.json({ error: "This account has no access to this regional service" }, { status: 403, headers });
    }
    (data as { triangleRegionId?: string; triangleUserId?: string }).triangleRegionId = env.TRIANGLE_REGION_ID;
    (data as { triangleUserId?: string }).triangleUserId = payload.sub;

    const response = await next();
    const responseHeaders = new Headers(response.headers);
    headers.forEach((value, key) => responseHeaders.set(key, value));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  } catch {
    return Response.json({ error: "Invalid or expired access token" }, { status: 401, headers });
  }
};
