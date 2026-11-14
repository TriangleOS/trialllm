import { describe, expect, it } from "vitest";
import { deviceModels, STAND_IN_MODELS, systemPrompt, triangleModel, trimHistory } from "../../mobile/src/ondevice/models";

describe("on-device model list", () => {
  it("offers only the Qwen3 stand-ins until Triangle LLM's GGUF is configured", () => {
    expect(deviceModels({})).toEqual(STAND_IN_MODELS);
    expect(STAND_IN_MODELS.every((m) => m.url.startsWith("https://huggingface.co/unsloth/Qwen3-"))).toBe(true);
  });

  it("puts Triangle LLM first once the repo and file are set", () => {
    const list = deviceModels({ EXPO_PUBLIC_TRIANGLE_GGUF_REPO: "TriangleOS/triangle-llm-v1-gguf", EXPO_PUBLIC_TRIANGLE_GGUF_FILE: "triangle-llm-v1-Q4_K_M.gguf", EXPO_PUBLIC_TRIANGLE_GGUF_MB: "1100" });
    expect(list[0].id).toBe("triangle-llm");
    expect(list[0].url).toBe("https://huggingface.co/TriangleOS/triangle-llm-v1-gguf/resolve/main/triangle-llm-v1-Q4_K_M.gguf?download=true");
    expect(list[0].approxMb).toBe(1100);
  });

  it("ignores malformed repo or file values", () => {
    expect(triangleModel({ EXPO_PUBLIC_TRIANGLE_GGUF_REPO: "https://evil.example/x", EXPO_PUBLIC_TRIANGLE_GGUF_FILE: "a.gguf" })).toBeNull();
    expect(triangleModel({ EXPO_PUBLIC_TRIANGLE_GGUF_REPO: "a/b", EXPO_PUBLIC_TRIANGLE_GGUF_FILE: "../a.gguf" })).toBeNull();
    expect(triangleModel({ EXPO_PUBLIC_TRIANGLE_GGUF_REPO: "a/b", EXPO_PUBLIC_TRIANGLE_GGUF_FILE: "a.bin" })).toBeNull();
  });

  it("never lets a stand-in claim to be Triangle LLM", () => {
    for (const m of STAND_IN_MODELS) expect(systemPrompt(m)).toContain("You are not Triangle LLM");
  });

  it("keeps the newest turns within the character budget", () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({ role: "user", content: `${i}`.padEnd(1000, "x") }));
    const kept = trimHistory(turns, 3000);
    expect(kept.length).toBe(3);
    expect(kept[2].content.startsWith("9")).toBe(true);
    expect(trimHistory([{ content: "y".repeat(9000) }], 3000).length).toBe(1);
  });
});
