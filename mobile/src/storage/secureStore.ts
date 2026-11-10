import * as SecureStore from "expo-secure-store";

/**
 * Supabase session storage backed by the iOS Keychain / Android Keystore.
 * SecureStore values should stay under ~2 KB and a Supabase session can be larger,
 * so values are split across numbered keys.
 */
const CHUNK = 1800;
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

// SecureStore keys may only contain letters, digits, ".", "-" and "_".
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = safe(key);
    const count = Number(await SecureStore.getItemAsync(`${base}.n`, OPTIONS));
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${base}.${i}`, OPTIONS);
      if (part === null) return null; // partial write: treat as signed out
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    const base = safe(key);
    await this.removeItem(key);
    const count = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${base}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), OPTIONS);
    }
    await SecureStore.setItemAsync(`${base}.n`, String(count), OPTIONS);
  },
  async removeItem(key: string): Promise<void> {
    const base = safe(key);
    const count = Number(await SecureStore.getItemAsync(`${base}.n`, OPTIONS)) || 0;
    await SecureStore.deleteItemAsync(`${base}.n`, OPTIONS);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${base}.${i}`, OPTIONS);
  },
};
