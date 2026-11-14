/**
 * Models the app can download and run on the phone (llama.cpp GGUF files).
 *
 * Until Triangle LLM v1 passes its hold-out test and its GGUF is published, the app runs the
 * same stand-in models as llm.triangleos.com/device: Qwen3 0.6B and 1.7B (Alibaba, Apache-2.0),
 * 4-bit quantised by Unsloth. When EXPO_PUBLIC_TRIANGLE_GGUF_REPO and EXPO_PUBLIC_TRIANGLE_GGUF_FILE
 * are set at build time, Triangle LLM is added to the list and becomes the default.
 */
export type DeviceModel = {
  id: string;
  name: string;
  /** Plain-language note shown under the name. */
  note: string;
  url: string;
  fileName: string;
  /** Exact size in bytes when known, used to check the download finished. */
  bytes?: number;
  /** Rough size for the list, in MB. */
  approxMb: number;
};

const hf = (repo: string, file: string) =>
  `https://huggingface.co/${repo}/resolve/main/${encodeURIComponent(file)}?download=true`;

export const STAND_IN_MODELS: DeviceModel[] = [
  {
    id: "qwen3-0.6b-q4",
    name: "Qwen3 0.6B (small, fastest)",
    note: "Stand-in until Triangle LLM v1 is published. Made by Alibaba (Apache-2.0). Best on phones with 4 GB RAM.",
    url: hf("unsloth/Qwen3-0.6B-GGUF", "Qwen3-0.6B-Q4_K_M.gguf"),
    fileName: "Qwen3-0.6B-Q4_K_M.gguf",
    bytes: 396705472,
    approxMb: 397,
  },
  {
    id: "qwen3-1.7b-q4",
    name: "Qwen3 1.7B (better answers)",
    note: "Stand-in until Triangle LLM v1 is published. Made by Alibaba (Apache-2.0). Needs about 6 GB RAM.",
    url: hf("unsloth/Qwen3-1.7B-GGUF", "Qwen3-1.7B-Q4_K_M.gguf"),
    fileName: "Qwen3-1.7B-Q4_K_M.gguf",
    bytes: 1107409472,
    approxMb: 1107,
  },
];

/** Triangle LLM, only when its GGUF location is set for this build. */
export function triangleModel(env: Record<string, string | undefined> = process.env): DeviceModel | null {
  const repo = env.EXPO_PUBLIC_TRIANGLE_GGUF_REPO?.trim();
  const file = env.EXPO_PUBLIC_TRIANGLE_GGUF_FILE?.trim();
  if (!repo || !file) return null;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w.-]+\.gguf$/i.test(file)) return null;
  const mb = Number(env.EXPO_PUBLIC_TRIANGLE_GGUF_MB);
  return {
    id: "triangle-llm",
    name: "Triangle LLM",
    note: "TriangleOS's model, fine-tuned from Qwen3 (Alibaba, Apache-2.0). Runs fully on this phone.",
    url: hf(repo, file),
    fileName: file,
    approxMb: Number.isFinite(mb) && mb > 0 ? mb : 0,
  };
}

export function deviceModels(env?: Record<string, string | undefined>): DeviceModel[] {
  const t = triangleModel(env);
  return t ? [t, ...STAND_IN_MODELS] : STAND_IN_MODELS;
}

/** Short system prompt. Only says what is true about this mode. */
export function systemPrompt(model: DeviceModel): string {
  const who = model.id === "triangle-llm"
    ? "You are Triangle LLM, a small model by TriangleOS (fine-tuned from Qwen3), running on the user's phone."
    : `You are ${model.name.split(" (")[0]}, an open model made by Alibaba, running on the user's phone inside the Triangle LLM app by TriangleOS. You are not Triangle LLM.`;
  return `${who} Answer briefly and plainly. If you don't know something, say so instead of guessing. Never invent facts, figures, people or quotes.`;
}

/** Keep the conversation inside the small context window: newest turns win. */
export function trimHistory<T extends { content: string }>(messages: T[], maxChars = 6000): T[] {
  const out: T[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length;
    if (total > maxChars && out.length > 0) break;
    out.unshift(messages[i]);
  }
  return out;
}
