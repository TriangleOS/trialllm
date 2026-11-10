import { verifyAccessToken } from "../lib/auth";
import { allowedOrigins, baseHeaders } from "../lib/cors";
import type { GatewayData, GatewayEnv } from "../lib/env";

/** Auth, region and CORS for every /v1 route. Other paths (the site itself) pass through untouched. */
export const onRequest: PagesFunction<GatewayEnv, string, GatewayData> = async (context) => {
  const { request, env, next, data } = context;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/v1/")) return next();

  const requestId = crypto.randomUUID();
  const origin = request.headers.get("Origin");
  const headers = baseHeaders(origin, env, requestId);
  if (origin && !allowedOrigins(env).has(origin)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  // Deleting your own account must work even if no region has been assigned to it.
  const requireRegion = url.pathname !== "/v1/account/delete";
  const auth = await verifyAccessToken(request.headers.get("Authorization"), env, undefined, { requireRegion });
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status, headers });

  data.triangleUserId = auth.sub;
  data.triangleRegionId = auth.regionId;
  data.requestId = requestId;

  const response = await next();
  const merged = new Headers(response.headers);
  headers.forEach((value, key) => merged.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
};
