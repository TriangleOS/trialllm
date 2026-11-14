import * as FileSystem from "expo-file-system/legacy";
import { initLlama, type LlamaContext } from "llama.rn";
import { systemPrompt, trimHistory, type DeviceModel } from "./models";

const dir = () => `${FileSystem.documentDirectory}models/`;
export const modelPath = (m: DeviceModel) => `${dir()}${m.fileName}`;

export async function isDownloaded(m: DeviceModel): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(modelPath(m));
  if (!info.exists) return false;
  return m.bytes ? (info as { size?: number }).size === m.bytes : true;
}

export type Download = { promise: Promise<void>; cancel: () => Promise<void> };

/** Download over HTTPS into the app's private storage. Wi-Fi is recommended in the UI. */
export function download(m: DeviceModel, onProgress: (fraction: number) => void): Download {
  const target = modelPath(m);
  const partial = `${target}.part`;
  const task = FileSystem.createDownloadResumable(m.url, partial, {}, (p) => {
    const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : m.bytes ?? 0;
    if (total > 0) onProgress(Math.min(1, p.totalBytesWritten / total));
  });
  const promise = (async () => {
    await FileSystem.makeDirectoryAsync(dir(), { intermediates: true }).catch(() => undefined);
    const free = await FileSystem.getFreeDiskStorageAsync().catch(() => Number.MAX_SAFE_INTEGER);
    const need = (m.bytes ?? m.approxMb * 1e6) * 1.1;
    if (need > 0 && free < need) throw new Error(`Not enough free space: about ${Math.ceil(need / 1e6)} MB needed.`);
    const res = await task.downloadAsync();
    if (!res) throw new Error("Download cancelled.");
    if (res.status !== 200) {
      await FileSystem.deleteAsync(partial, { idempotent: true });
      throw new Error(`Download failed (HTTP ${res.status}).`);
    }
    const info = await FileSystem.getInfoAsync(partial);
    const size = (info as { size?: number }).size;
    if (m.bytes && size !== m.bytes) {
      await FileSystem.deleteAsync(partial, { idempotent: true });
      throw new Error("The download was incomplete. Please try again.");
    }
    await FileSystem.moveAsync({ from: partial, to: target });
  })();
  return {
    promise,
    cancel: async () => {
      await task.cancelAsync().catch(() => undefined);
      await FileSystem.deleteAsync(partial, { idempotent: true });
    },
  };
}

export async function remove(m: DeviceModel): Promise<void> {
  await FileSystem.deleteAsync(modelPath(m), { idempotent: true });
}

export type Turn = { role: "user" | "assistant"; content: string };

/** One loaded model. Generation happens on the phone's CPU (Metal GPU on iPhone). */
export class DeviceChat {
  private constructor(private ctx: LlamaContext, readonly model: DeviceModel) {}

  static async load(m: DeviceModel, onProgress?: (fraction: number) => void): Promise<DeviceChat> {
    const ctx = await initLlama(
      { model: modelPath(m), n_ctx: 4096, n_gpu_layers: 99, use_mlock: false },
      (p) => onProgress?.(p / 100),
    );
    return new DeviceChat(ctx, m);
  }

  async reply(history: Turn[], onText: (textSoFar: string) => void): Promise<string> {
    let text = "";
    const res = await this.ctx.completion(
      {
        messages: [{ role: "system", content: systemPrompt(this.model) }, ...trimHistory(history)],
        n_predict: 512,
        temperature: 0.7,
        top_p: 0.8,
        top_k: 20,
        // Qwen3 chat template: answer directly, no hidden "thinking" pass (much faster on a phone).
        chat_template_kwargs: { enable_thinking: false },
        stop: ["<|im_end|>", "<|endoftext|>"],
      },
      (d) => {
        text = d.content ?? text + d.token;
        onText(text);
      },
    );
    return (res.content ?? res.text ?? text).trim();
  }

  stop(): Promise<void> {
    return this.ctx.stopCompletion();
  }

  release(): Promise<void> {
    return this.ctx.release();
  }
}
