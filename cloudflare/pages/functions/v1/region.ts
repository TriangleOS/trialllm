interface Env { TRIANGLE_REGION_ID: string }
interface Data { triangleRegionId?: string; triangleUserId?: string }

export const onRequestGet: PagesFunction<Env, string, Data> = async ({ env, data }) => {
  if (!data.triangleUserId || !data.triangleRegionId) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({ regionId: env.TRIANGLE_REGION_ID }, { headers: { "Cache-Control": "no-store" } });
};
