interface Env { TRIANGLE_REGION_ID: string; TRIANGLE_PUBLIC_MODEL_ID?: string }
interface Data { triangleRegionId?: string; triangleUserId?: string }

/** OpenAI-compatible model discovery; exposes only the configured public model alias. */
export const onRequestGet: PagesFunction<Env, string, Data> = async ({ env, data }) => {
  if (!data.triangleUserId || data.triangleRegionId !== env.TRIANGLE_REGION_ID) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const model = env.TRIANGLE_PUBLIC_MODEL_ID || "triangle-from-scratch-research-v1";
  return Response.json({
    object: "list",
    data: [{ id: model, object: "model", created: 0, owned_by: "triangleos", region: env.TRIANGLE_REGION_ID }],
  }, { headers: { "Cache-Control": "no-store" } });
};
