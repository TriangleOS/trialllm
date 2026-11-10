import { SignJWT } from "jose";
import type { GatewayEnv } from "../../cloudflare/pages/lib/env";

export const SECRET = "test-secret-that-is-at-least-32-characters-long";
export const ISSUER = "https://example-ref.supabase.co/auth/v1";

export function testEnv(overrides: Partial<GatewayEnv> = {}): GatewayEnv {
  return {
    OIDC_ISSUER: ISSUER,
    OIDC_AUDIENCE: "authenticated",
    SUPABASE_JWT_SECRET: SECRET,
    TRIANGLE_REGION_ID: "uk-1",
    TRIANGLE_ALLOWED_ORIGINS: "https://llm.triangleos.com, https://app.triangleos.com",
    TRIANGLE_MODEL_ORIGIN: "https://inference.example.test",
    TRIANGLE_INFERENCE_TOKEN: "service-token-service-token-service-token",
    ...overrides,
  };
}

export async function hsToken(claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string | number; sub?: string | null; secret?: string } = {}) {
  let jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m");
  if (opts.sub !== null) jwt = jwt.setSubject(opts.sub ?? "user-123");
  return jwt.sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

/** Runs the Pages middleware, then the route handler, like Pages does. */
export async function runPages(
  request: Request,
  env: GatewayEnv,
  route: (ctx: any) => Promise<Response> | Response,
): Promise<Response> {
  const { onRequest } = await import("../../cloudflare/pages/functions/_middleware");
  const data: Record<string, unknown> = {};
  const ctx: any = { request, env, data, params: {}, waitUntil() {}, passThroughOnException() {} };
  ctx.next = async () => route({ ...ctx, data });
  return (onRequest as any)(ctx);
}
