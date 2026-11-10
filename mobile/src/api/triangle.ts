import { createTriangleClient } from "@triangleos/llm-sdk";
import { supabase } from "../auth/supabase";

/** Shared SDK client using the signed-in user's own Supabase access token. */
export const triangle = createTriangleClient({
  baseUrl: process.env.EXPO_PUBLIC_TRIANGLE_API_URL || "https://llm.triangleos.com",
  getToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
