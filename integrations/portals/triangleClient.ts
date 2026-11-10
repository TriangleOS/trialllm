// Shared Triangle API client for a portal with an existing login.
// Prefer the typed SDK in sdk/src. Supply accessToken from the portal's session SDK; never store the inference-service secret here.
export type TriangleMessage = { role: "system" | "user" | "assistant"; content: string };
export type TriangleCompletion = {
  id: string;
  model: string;
  choices: Array<{ index: number; message: { role: string; content: string }; finish_reason: string }>;
  notice?: string;
};

export class TriangleApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "TriangleApiError";
  }
}

export function createTriangleClient(options: {
  baseUrl?: string;
  getAccessToken: () => Promise<string | null>;
}) {
  const baseUrl = (options.baseUrl || "https://llm.triangleos.com").replace(/\/+$/, "");
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) throw new TriangleApiError(401, "Sign in to use Triangle AI.");
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers },
      cache: "no-store",
    });
    if (!response.ok) {
      let message = "Triangle AI is unavailable.";
      try { message = (await response.json() as { error?: string }).error || message; } catch { /* safe default */ }
      throw new TriangleApiError(response.status, message);
    }
    return response.json() as Promise<T>;
  }
  return {
    region: () => call<{ regionId: string }>("/v1/region"),
    models: () => call<{ object: "list"; data: Array<{ id: string; owned_by: string; region: string }> }>("/v1/models"),
    complete: (messages: TriangleMessage[], options: { max_tokens?: number; temperature?: number } = {}) =>
      call<TriangleCompletion>("/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ messages, ...options, stream: false }),
      }),
  };
}
