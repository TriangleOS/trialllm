export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{ index: number; message: ChatMessage; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  notice?: string;
}

export interface RegionResponse {
  regionId: string;
  assignedTo: string;
}

export interface ModelInfo {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  region: string;
  tier: string;
  notice: string;
  languages: string[];
}

export interface ModelListResponse {
  object: "list";
  data: ModelInfo[];
}

export interface ChatChunk {
  id: string;
  object: "chat.completion.chunk";
  model: string;
  choices: Array<{ index: number; delta: Partial<ChatMessage>; finish_reason: string | null }>;
}
