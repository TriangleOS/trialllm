/** Copy this module into the existing Lovable project's frontend, then use its
 * authenticated user's access token. Never add model/admin credentials here. */
export type TriangleChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type TriangleChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{ message?: { role: string; content: string }; finish_reason?: string }>;
  [key: string]: unknown;
};

export class TriangleApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "TriangleApiError";
  }
}

export function createTriangleApi(apiBaseUrl: string, accessToken: () => Promise<string | null>) {
  const base = apiBaseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await accessToken();
    if (!token) throw new TriangleApiError(401, "Please sign in to use Triangle AI.");
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      let message = "Triangle AI is unavailable.";
      try {
        const body = await response.json() as { error?: string };
        if (body.error) message = body.error;
      } catch { /* use safe default */ }
      throw new TriangleApiError(response.status, message);
    }
    return response.json() as Promise<T>;
  }

  return {
    getRegion: () => request<{ regionId: string }>("/v1/region"),
    chat: (messages: TriangleChatMessage[], options: { temperature?: number; max_tokens?: number } = {}) =>
      request<TriangleChatResponse>("/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ messages, ...options, stream: false }),
      }),
  };
}
