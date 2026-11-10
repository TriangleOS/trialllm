import type { GatewayEnv } from "./env";

export function allowedOrigins(env: Pick<GatewayEnv, "TRIANGLE_ALLOWED_ORIGINS">): Set<string> {
  return new Set((env.TRIANGLE_ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean));
}

/** Headers for every /v1 response. Allow-Origin is echoed only for an exact allow-listed origin. */
export function baseHeaders(origin: string | null, env: Pick<GatewayEnv, "TRIANGLE_ALLOWED_ORIGINS">, requestId: string): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Expose-Headers": "X-Request-Id",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
  });
  if (origin && allowedOrigins(env).has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}
