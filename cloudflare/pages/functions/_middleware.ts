import { createRemoteJWKSet, jwtVerify } from "jose";

interface Env {
  OIDC_ISSUER: string;
  OIDC_AUDIENCE: string;
  OIDC_JWKS_URL: string;
  TRIANGLE_REGION_ID: string;
  TRIANGLE_ALLOWED_ORIGIN: string;
  TRIANGLE_MODEL_ORIGIN: string;
  TRIANGLE_INFERENCE_TOKEN: string;
}

let jwksUrl = "";
let remoteKeys: ReturnType<typeof createRemoteJWKSet> | undefined;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next, data } = context;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/v1/")) return next();

  const origin = request.headers.get("Origin");
  if (origin && origin !== env.TRIANGLE_ALLOWED_ORIGIN) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const corsHeaders = {
    "Access-Control-Allow-Origin": env.TRIANGLE_ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (!env.OIDC_ISSUER || !env.OIDC_AUDIENCE || !env.OIDC_JWKS_URL || !env.TRIANGLE_REGION_ID) {
    return Response.json({ error: "Regional API is not configured" }, { status: 503, headers: corsHeaders });
  }
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) return Response.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });

  try {
    if (jwksUrl !== env.OIDC_JWKS_URL) {
      jwksUrl = env.OIDC_JWKS_URL;
      remoteKeys = createRemoteJWKSet(new URL(jwksUrl));
    }
    const { payload } = await jwtVerify(match[1], remoteKeys!, {
      issuer: env.OIDC_ISSUER,
      audience: env.OIDC_AUDIENCE,
      algorithms: ["RS256", "ES256"],
    });
    if (typeof payload.sub !== "string" || payload.triangle_region_id !== env.TRIANGLE_REGION_ID) {
      return Response.json({ error: "This account has no access to this regional service" }, { status: 403, headers: corsHeaders });
    }
    // The deployment config is authoritative for routing; only identity is carried forward.
    (data as { triangleRegionId?: string; triangleUserId?: string }).triangleRegionId = env.TRIANGLE_REGION_ID;
    (data as { triangleUserId?: string }).triangleUserId = payload.sub;

    const response = await next();
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return Response.json({ error: "Invalid or expired access token" }, { status: 401, headers: corsHeaders });
  }
};
