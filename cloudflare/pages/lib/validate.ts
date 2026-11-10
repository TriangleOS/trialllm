export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string }
export interface ChatBody {
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

const BODY_KEYS = new Set(["messages", "stream", "temperature", "max_tokens"]);
const MESSAGE_KEYS = new Set(["role", "content"]);
const ROLES = new Set<string>(["system", "user", "assistant"]);
export const LIMITS = { messages: 40, contentChars: 20_000, totalChars: 60_000, maxTokens: 512, bodyBytes: 64 * 1024 };

/**
 * Strict validation. Unknown fields (model, region, url, api keys, tools...) are rejected,
 * so a caller can never steer routing or credentials.
 */
export function validateChatBody(value: unknown): { ok: true; body: ChatBody } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "Body must be a JSON object" };
  const raw = value as Record<string, unknown>;
  const unknown = Object.keys(raw).filter((k) => !BODY_KEYS.has(k));
  if (unknown.length) return { ok: false, error: `Unsupported field: ${unknown[0]}` };
  if (!Array.isArray(raw.messages) || raw.messages.length < 1 || raw.messages.length > LIMITS.messages) {
    return { ok: false, error: `messages must be an array of 1-${LIMITS.messages} items` };
  }
  if (raw.stream !== undefined && typeof raw.stream !== "boolean") return { ok: false, error: "stream must be a boolean" };
  if (raw.temperature !== undefined && (typeof raw.temperature !== "number" || !Number.isFinite(raw.temperature) || raw.temperature < 0 || raw.temperature > 2)) {
    return { ok: false, error: "temperature must be between 0 and 2" };
  }
  if (raw.max_tokens !== undefined && (!Number.isInteger(raw.max_tokens) || (raw.max_tokens as number) < 1 || (raw.max_tokens as number) > LIMITS.maxTokens)) {
    return { ok: false, error: `max_tokens must be an integer from 1 to ${LIMITS.maxTokens}` };
  }
  let total = 0;
  const messages: ChatMessage[] = [];
  for (const item of raw.messages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, error: "Invalid message" };
    const m = item as Record<string, unknown>;
    if (Object.keys(m).some((k) => !MESSAGE_KEYS.has(k))) return { ok: false, error: "Messages may only contain role and content" };
    if (typeof m.role !== "string" || !ROLES.has(m.role)) return { ok: false, error: "Invalid message role" };
    if (typeof m.content !== "string" || m.content.length < 1 || m.content.length > LIMITS.contentChars) {
      return { ok: false, error: `Message content must be 1-${LIMITS.contentChars} characters` };
    }
    total += m.content.length;
    messages.push({ role: m.role as ChatRole, content: m.content });
  }
  if (total > LIMITS.totalChars) return { ok: false, error: "Conversation is too long" };
  const body: ChatBody = { messages };
  if (raw.stream !== undefined) body.stream = raw.stream as boolean;
  if (raw.temperature !== undefined) body.temperature = raw.temperature as number;
  if (raw.max_tokens !== undefined) body.max_tokens = raw.max_tokens as number;
  return { ok: true, body };
}
