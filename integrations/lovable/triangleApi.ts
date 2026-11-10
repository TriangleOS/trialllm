/**
 * Drop-in for TriangleOS web portals that sign in with the shared Supabase project
 * (app, chat, trade, trina, lawbooks...). Copy `sdk/src/*` into the portal as
 * `src/lib/triangle-sdk/` and this file as `src/lib/triangleApi.ts`.
 *
 * The browser only ever sends the signed-in user's own Supabase access token.
 * Never put TRIANGLE_INFERENCE_TOKEN or any model key in a portal.
 */
import { supabase } from "@/integrations/supabase/client";
import { createTriangleClient } from "./triangle-sdk";

export const triangle = createTriangleClient({
  baseUrl: import.meta.env.VITE_TRIANGLE_API_URL || "https://llm.triangleos.com",
  getToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});

export { TriangleApiError } from "./triangle-sdk";
