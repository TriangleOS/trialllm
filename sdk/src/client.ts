import type { ChatRequest, ChatResponse, ModelListResponse, RegionResponse } from "./types";

export class TriangleApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly requestId?: string) {
    super(message);
    this.name = "TriangleApiError";
  }
}

export interface TriangleClientOptions {
  /** Defaults to https://llm.triangleos.com */
  baseUrl?: string;
  /** Returns the signed-in user's current access token (e.g. Supabase session.access_token). */
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_BASE_URL = "https://llm.triangleos.com";

export async function errorFrom(res: Response): Promise<TriangleApiError> {
  let message = "Triangle AI is unavailable.";
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) message = body.error;
  } catch { /* keep safe default */ }
  return new TriangleApiError(res.status, message, res.headers.get("X-Request-Id") ?? undefined);
}

export function createTriangleClient(opts: TriangleClientOptions) {
  const base = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  // Bind so a bare `fetch` keeps its global receiver in browsers.
  const doFetch: typeof fetch = opts.fetchImpl ?? ((input, init) => fetch(input, init));

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await opts.getToken();
    if (!token) throw new TriangleApiError(401, "Please sign in.");
    return { Authorization: `Bearer ${token}` };
  }

  async function call<T>(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<T> {
    const headers: Record<string, string> = { ...(await authHeaders()) };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, cache: "no-store" });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") throw err;
      throw new TriangleApiError(0, "You appear to be offline or Triangle AI cannot be reached.");
    }
    if (!res.ok) throw await errorFrom(res);
    return (await res.json()) as T;
  }

  return {
    baseUrl: base,
    authHeaders,
    fetch: doFetch,
    getRegion: (signal?: AbortSignal) => call<RegionResponse>("/v1/region", { signal }),
    listModels: (signal?: AbortSignal) => call<ModelListResponse>("/v1/models", { signal }),
    /** Permanently deletes the signed-in user's TriangleOS account (shared by all TriangleOS apps). */
    deleteAccount: () => call<{ deleted: true }>("/v1/account/delete", { method: "POST", body: "{}" }),
    chat: (req: ChatRequest, signal?: AbortSignal) =>
      call<ChatResponse>("/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ messages: req.messages, temperature: req.temperature, max_tokens: req.max_tokens, stream: false }),
        signal,
      }),
  };
}

export type TriangleClient = ReturnType<typeof createTriangleClient>;
