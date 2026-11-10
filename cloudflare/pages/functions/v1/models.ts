import { DEFAULT_MODEL_ID, type GatewayData, type GatewayEnv } from "../../lib/env";

export const MODEL_NOTICE = "Research prototype. Not trained for production use; not evaluated for accuracy, safety or language coverage.";

/** OpenAI-style model list, plus an honest status notice. */
export const onRequestGet: PagesFunction<GatewayEnv, string, GatewayData> = async ({ env, data }) => {
  if (!data.triangleUserId || data.triangleRegionId !== env.TRIANGLE_REGION_ID) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const id = env.TRIANGLE_PUBLIC_MODEL_ID || DEFAULT_MODEL_ID;
  return Response.json({
    object: "list",
    data: [{
      id,
      object: "model",
      created: 0,
      owned_by: "triangleos",
      region: env.TRIANGLE_REGION_ID,
      tier: "research-preview",
      notice: MODEL_NOTICE,
      languages: [] as string[],
    }],
  });
};
