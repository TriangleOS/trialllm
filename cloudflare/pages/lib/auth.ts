import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { GatewayEnv } from "./env";

export type AuthResult =
  | { ok: true; sub: string; regionId: string }
  | { ok: false; status: 401 | 403 | 503; error: string };

type KeySource = { kind: "jwks"; getKey: JWTVerifyGetKey } | { kind: "secret"; key: Uint8Array };

let cachedJwksUrl = "";
let cachedJwks: JWTVerifyGetKey | undefined;

function keySourceFromEnv(env: GatewayEnv): KeySource | null {
  if (env.OIDC_JWKS_URL) {
    if (cachedJwksUrl !== env.OIDC_JWKS_URL || !cachedJwks) {
      cachedJwksUrl = env.OIDC_JWKS_URL;
      cachedJwks = createRemoteJWKSet(new URL(env.OIDC_JWKS_URL));
    }
    return { kind: "jwks", getKey: cachedJwks };
  }
  if (env.SUPABASE_JWT_SECRET && env.SUPABASE_JWT_SECRET.length >= 32) {
    return { kind: "secret", key: new TextEncoder().encode(env.SUPABASE_JWT_SECRET) };
  }
  return null;
}

/**
 * The region must come from a claim the user cannot edit: a top-level custom claim
 * (from the identity provider or a Supabase access-token hook) or Supabase `app_metadata`
 * (writable only with the service role). `user_metadata` is user-editable and is ignored.
 */
export function regionClaim(payload: JWTPayload): string | undefined {
  const top = (payload as { triangle_region_id?: unknown }).triangle_region_id;
  if (typeof top === "string" && top) return top;
  const appMeta = (payload as { app_metadata?: unknown }).app_metadata;
  if (appMeta && typeof appMeta === "object") {
    const nested = (appMeta as { triangle_region_id?: unknown }).triangle_region_id;
    if (typeof nested === "string" && nested) return nested;
  }
  return undefined;
}

export async function verifyAccessToken(
  authorization: string | null,
  env: GatewayEnv,
  override?: KeySource,
): Promise<AuthResult> {
  if (!env.OIDC_ISSUER || !env.OIDC_AUDIENCE || !env.TRIANGLE_REGION_ID) {
    return { ok: false, status: 503, error: "Regional API is not configured" };
  }
  const source = override ?? keySourceFromEnv(env);
  if (!source) return { ok: false, status: 503, error: "Regional API is not configured" };

  const match = authorization?.match(/^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i);
  if (!match?.[1]) return { ok: false, status: 401, error: "Authentication required" };

  let payload: JWTPayload;
  try {
    const options = { issuer: env.OIDC_ISSUER, audience: env.OIDC_AUDIENCE };
    payload = source.kind === "jwks"
      ? (await jwtVerify(match[1], source.getKey, { ...options, algorithms: ["RS256", "ES256"] })).payload
      : (await jwtVerify(match[1], source.key, { ...options, algorithms: ["HS256"] })).payload;
  } catch (err) {
    // A JWKS that cannot be fetched is our outage, not the caller's bad token.
    if (err instanceof errors.JWKSTimeout || !(err instanceof errors.JOSEError)) {
      return { ok: false, status: 503, error: "Identity keys are unavailable" };
    }
    return { ok: false, status: 401, error: "Invalid or expired access token" };
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    return { ok: false, status: 401, error: "Invalid or expired access token" };
  }
  if (regionClaim(payload) !== env.TRIANGLE_REGION_ID) {
    return { ok: false, status: 403, error: "This account has no access to this regional service" };
  }
  return { ok: true, sub: payload.sub, regionId: env.TRIANGLE_REGION_ID };
}

export type { KeySource };
