import type { ChatMessage } from "@triangleos/llm-sdk";
import { TriangleApiError } from "@triangleos/llm-sdk";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { triangle } from "../api/triangle";
import { colors } from "../theme";

export default function ChatScreen({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => () => aborter.current?.abort(), []);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    aborter.current = new AbortController();
    try {
      // Keep the last 40 turns: the gateway rejects longer conversations.
      const res = await triangle.chat({ messages: next.slice(-40) }, aborter.current.signal);
      const reply = res.choices[0]?.message;
      setMessages(reply ? [...next, reply] : next);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      if (e instanceof TriangleApiError && e.status === 0) setError("You're offline. Your message was not sent.");
      else setError(e instanceof Error ? e.message : "Triangle AI is unavailable.");
    } finally {
      setBusy(false);
      aborter.current = null;
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable onPress={onBack}><Text style={styles.back}>‹ Region</Text></Pressable>
      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.user : styles.assistant]}>
            <Text style={styles.text}>{item.content}</Text>
          </View>
        )}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {busy && (
        <Pressable onPress={() => aborter.current?.abort()} style={styles.cancel}>
          <ActivityIndicator /><Text style={styles.muted}> Cancel</Text>
        </Pressable>
      )}
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Ask Triangle AI…"
          placeholderTextColor={colors.muted} multiline editable={!busy} maxLength={20000} />
        <Pressable style={styles.send} onPress={send} disabled={busy} accessibilityRole="button">
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
      <Text style={styles.notice}>Research preview. Answers may be wrong or nonsensical.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 12, backgroundColor: colors.bg },
  back: { color: colors.muted, marginBottom: 8 },
  bubble: { padding: 10, borderRadius: 10, marginVertical: 4, maxWidth: "85%" },
  user: { alignSelf: "flex-end", backgroundColor: colors.user },
  assistant: { alignSelf: "flex-start", backgroundColor: colors.panel },
  text: { color: colors.text },
  muted: { color: colors.muted },
  cancel: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 6 },
  inputRow: { flexDirection: "row", marginTop: 8 },
  input: { flex: 1, backgroundColor: colors.panel, color: colors.text, padding: 10, borderRadius: 8, maxHeight: 120 },
  send: { marginLeft: 8, backgroundColor: colors.accent, paddingHorizontal: 16, justifyContent: "center", borderRadius: 8 },
  sendText: { color: "#fff", fontWeight: "600" },
  error: { color: colors.error, marginVertical: 4 },
  notice: { color: colors.muted, fontSize: 10, marginTop: 6, textAlign: "center" },
});
