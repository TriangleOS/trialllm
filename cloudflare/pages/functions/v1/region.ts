import type { GatewayData, GatewayEnv } from "../../lib/env";

export const onRequestGet: PagesFunction<GatewayEnv, string, GatewayData> = async ({ env, data }) => {
  if (!data.triangleUserId || data.triangleRegionId !== env.TRIANGLE_REGION_ID) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  return Response.json({ regionId: env.TRIANGLE_REGION_ID, assignedTo: data.triangleUserId });
};
