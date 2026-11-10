import type { GatewayData, GatewayEnv } from "../../../lib/env";

/**
 * Deletes the signed-in user's own account (App Store guideline 5.1.1(v), Google Play account deletion policy).
 * The user id comes only from the verified token. Accounts are shared across TriangleOS apps,
 * so this removes the TriangleOS sign-in everywhere; the app says so before calling it.
 */
export const onRequestPost: PagesFunction<GatewayEnv, string, GatewayData> = async ({ env, data }) => {
  if (!data.triangleUserId) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Account deletion is not configured" }, { status: 503 });
  }
  let target: URL;
  try {
    target = new URL(`/auth/v1/admin/users/${encodeURIComponent(data.triangleUserId)}`, env.SUPABASE_URL);
  } catch {
    return Response.json({ error: "Account deletion is not configured" }, { status: 503 });
  }
  if (target.protocol !== "https:") return Response.json({ error: "Account deletion is not configured" }, { status: 503 });
  try {
    const res = await fetch(target, {
      method: "DELETE",
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      redirect: "error",
    });
    if (res.ok || res.status === 404) return Response.json({ deleted: true });
    return Response.json({ error: "Your account could not be deleted. Please contact support." }, { status: 502 });
  } catch {
    return Response.json({ error: "Your account could not be deleted. Please contact support." }, { status: 502 });
  }
};
