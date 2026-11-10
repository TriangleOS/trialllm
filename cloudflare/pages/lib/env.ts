/** Variables and secrets for the Pages gateway. Set them in the Pages project, never in Git. */
export interface GatewayEnv {
  /** Exact `iss` claim. For Supabase: https://<project-ref>.supabase.co/auth/v1 */
  OIDC_ISSUER: string;
  /** Exact `aud` claim. For Supabase user sessions: authenticated */
  OIDC_AUDIENCE: string;
  /** JWKS for RS256/ES256 tokens. For Supabase asymmetric keys: <issuer>/.well-known/jwks.json */
  OIDC_JWKS_URL?: string;
  /** Secret: only for Supabase projects still on the legacy HS256 JWT secret. */
  SUPABASE_JWT_SECRET?: string;
  TRIANGLE_REGION_ID: string;
  /** Comma-separated exact origins, e.g. https://llm.triangleos.com,https://app.triangleos.com */
  TRIANGLE_ALLOWED_ORIGINS: string;
  TRIANGLE_MODEL_ORIGIN?: string;
  /** Secret shared with the private inference service (32+ characters). */
  TRIANGLE_INFERENCE_TOKEN?: string;
  TRIANGLE_PUBLIC_MODEL_ID?: string;
  /** For account deletion only: https://<project-ref>.supabase.co */
  SUPABASE_URL?: string;
  /** Secret. For account deletion only (Apple and Google require in-app deletion). */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Optional Cloudflare Access service token in front of the tunnel hostname (free). */
  TRIANGLE_ACCESS_CLIENT_ID?: string;
  TRIANGLE_ACCESS_CLIENT_SECRET?: string;
}

// A type alias (not an interface) so it satisfies PagesFunction's Record<string, unknown> constraint.
export type GatewayData = {
  triangleRegionId?: string;
  triangleUserId?: string;
  requestId?: string;
};

export const DEFAULT_MODEL_ID = "triangle-from-scratch-research-v1";
