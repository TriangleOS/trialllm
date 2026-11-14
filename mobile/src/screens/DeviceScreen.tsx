import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { DeviceChat, download, isDownloaded, remove, type Download, type Turn } from "../ondevice/engine";
import { deviceModels, type DeviceModel } from "../ondevice/models";
import { colors } from "../theme";

const MODELS = deviceModels();

/** Pick, download and load a model that runs entirely on this phone. No account needed. */
export default function DeviceScreen() {
  const [have, setHave] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<{ id: string; fraction: number; phase: "download" | "load" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<DeviceChat | null>(null);
  const active = useRef<Download | null>(null);

  async function refresh() {
    const entries = await Promise.all(MODELS.map(async (m) => [m.id, await isDownloaded(m).catch(() => false)] as const));
    setHave(Object.fromEntries(entries));
  }
  useEffect(() => { refresh(); return () => { active.current?.cancel(); }; }, []);

  async function get(m: DeviceModel) {
    setError(null);
    setProgress({ id: m.id, fraction: 0, phase: "download" });
    const d = download(m, (fraction) => setProgress({ id: m.id, fraction, phase: "download" }));
    active.current = d;
    try { await d.promise; await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Download failed."); }
    finally { active.current = null; setProgress(null); }
  }

  async function open(m: DeviceModel) {
    setError(null);
    setProgress({ id: m.id, fraction: 0, phase: "load" });
    try { setChat(await DeviceChat.load(m, (fraction) => setProgress({ id: m.id, fraction, phase: "load" }))); }
    catch (e) { setError(e instanceof Error ? `Couldn't start the model: ${e.message}` : "Couldn't start the model. The phone may not have enough memory."); }
    finally { setProgress(null); }
  }

  async function del(m: DeviceModel) {
    await remove(m);
    await refresh();
  }

  if (chat) return <DeviceChatView chat={chat} onClose={async () => { await chat.release(); setChat(null); }} />;

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>Run on this phone</Text>
      <Text style={styles.body}>
        Download a model once (Wi-Fi recommended). After that it answers with no internet, no account and no server:
        your messages stay on this phone.
      </Text>
      {MODELS.map((m) => {
        const busy = progress?.id === m.id;
        return (
          <View key={m.id} style={styles.card}>
            <Text style={styles.name}>{m.name}</Text>
            <Text style={styles.note}>{m.note}</Text>
            {m.approxMb > 0 && <Text style={styles.note}>Download: about {m.approxMb >= 1000 ? `${(m.approxMb / 1000).toFixed(1)} GB` : `${m.approxMb} MB`}</Text>}
            {busy ? (
              <View style={styles.row}>
                <ActivityIndicator />
                <Text style={styles.note}> {progress.phase === "download" ? "Downloading" : "Starting"} {Math.round(progress.fraction * 100)}%</Text>
                {progress.phase === "download" && (
                  <Pressable onPress={() => active.current?.cancel()}><Text style={styles.link}>  Cancel</Text></Pressable>
                )}
              </View>
            ) : have[m.id] ? (
              <View style={styles.row}>
                <Pressable style={styles.button} onPress={() => open(m)} disabled={!!progress}><Text style={styles.buttonText}>Chat</Text></Pressable>
                <Pressable onPress={() => del(m)} disabled={!!progress}><Text style={styles.link}>  Delete from phone</Text></Pressable>
              </View>
            ) : (
              <Pressable style={styles.button} onPress={() => get(m)} disabled={!!progress}><Text style={styles.buttonText}>Download</Text></Pressable>
            )}
          </View>
        );
      })}
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.small}>Small models make mistakes. Check anything important.</Text>
    </ScrollView>
  );
}

function DeviceChatView({ chat, onClose }: { chat: DeviceChat; onClose: () => void }) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = draft !== null;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Turn[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setDraft("");
    try {
      const reply = await chat.reply(next, setDraft);
      setMessages(reply ? [...next, { role: "assistant", content: reply }] : next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The model stopped unexpectedly.");
    } finally {
      setDraft(null);
    }
  }

  const shown = busy ? [...messages, { role: "assistant" as const, content: draft || "…" }] : messages;
  return (
    <KeyboardAvoidingView style={styles.chat} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable onPress={onClose} disabled={busy}><Text style={styles.link}>‹ Models · {chat.model.name}</Text></Pressable>
      <FlatList
        data={shown}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.user : styles.assistant]}>
            <Text style={styles.text}>{item.content}</Text>
          </View>
        )}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {busy && <Pressable onPress={() => chat.stop()} style={styles.row}><Text style={styles.link}>Stop</Text></Pressable>}
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Ask, offline…"
          placeholderTextColor={colors.muted} multiline editable={!busy} maxLength={4000} />
        <Pressable style={styles.send} onPress={send} disabled={busy} accessibilityRole="button">
          <Text style={styles.buttonText}>Send</Text>
        </Pressable>
      </View>
      <Text style={styles.small}>Runs on this phone. Answers may be wrong.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, backgroundColor: colors.bg },
  chat: { flex: 1, padding: 12, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  body: { color: colors.text, marginBottom: 12 },
  card: { backgroundColor: colors.panel, borderRadius: 10, padding: 12, marginBottom: 10 },
  name: { color: colors.text, fontWeight: "600", marginBottom: 4 },
  note: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  button: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignSelf: "flex-start" },
  buttonText: { color: "#fff", fontWeight: "600" },
  link: { color: colors.muted, paddingVertical: 4 },
  error: { color: colors.error, marginVertical: 6 },
  small: { color: colors.muted, fontSize: 10, marginTop: 8, textAlign: "center" },
  bubble: { padding: 10, borderRadius: 10, marginVertical: 4, maxWidth: "85%" },
  user: { alignSelf: "flex-end", backgroundColor: colors.user },
  assistant: { alignSelf: "flex-start", backgroundColor: colors.panel },
  text: { color: colors.text },
  inputRow: { flexDirection: "row", marginTop: 8 },
  input: { flex: 1, backgroundColor: colors.panel, color: colors.text, padding: 10, borderRadius: 8, maxHeight: 120 },
  send: { marginLeft: 8, backgroundColor: colors.accent, paddingHorizontal: 16, justifyContent: "center", borderRadius: 8 },
});
