// React Native-friendly client for Triangle's shared regional Pages API.
// Integrate getAccessToken() with the app's auth SDK and store refresh credentials
// only in Keychain/Keystore; do not bundle service/model credentials.
export type MobileTriangleMessage = { role: "system" | "user" | "assistant"; content: string };
export type MobileTriangleReply = { regionId?: string; text: string; model: string; notice?: string };

export async function triangleMobileChat(args: {
  apiBaseUrl?: string;
  getAccessToken: () => Promise<string | null>;
  messages: MobileTriangleMessage[];
  signal?: AbortSignal;
}): Promise<MobileTriangleReply> {
  const token = await args.getAccessToken();
  if (!token) throw new Error("Sign in to use Triangle AI.");
  const base = (args.apiBaseUrl || "https://llm.triangleos.com").replace(/\/+$/, "");
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: args.messages, stream: false }),
    signal: args.signal,
  });
  if (!response.ok) {
    let message = "Triangle AI is unavailable.";
    try { message = (await response.json() as { error?: string }).error || message; } catch { /* safe default */ }
    throw new Error(message);
  }
  const completion = await response.json() as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    notice?: string;
  };
  return {
    text: completion.choices?.[0]?.message?.content || "",
    model: completion.model || "triangle-model",
    notice: completion.notice,
  };
}

export async function triangleMobileRegion(args: {
  apiBaseUrl?: string;
  getAccessToken: () => Promise<string | null>;
}): Promise<{ regionId: string }> {
  const token = await args.getAccessToken();
  if (!token) throw new Error("Sign in to use Triangle AI.");
  const base = (args.apiBaseUrl || "https://llm.triangleos.com").replace(/\/+$/, "");
  const response = await fetch(`${base}/v1/region`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to verify Triangle AI region.");
  return response.json() as Promise<{ regionId: string }>;
}
