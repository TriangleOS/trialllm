import type { ModelInfo, RegionResponse } from "@triangleos/llm-sdk";
import { TriangleApiError } from "@triangleos/llm-sdk";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { triangle } from "../api/triangle";
import { useAuth } from "../auth/AuthProvider";
import { colors } from "../theme";

/** Shows the region the server assigned to this account. The app cannot pick a region. */
export default function RegionScreen({ onContinue }: { onContinue: () => void }) {
  const { signOut, session } = useAuth();
  const [region, setRegion] = useState<RegionResponse | null>(null);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, m] = await Promise.all([triangle.getRegion(), triangle.listModels()]);
      setRegion(r);
      setModel(m.data[0] ?? null);
    } catch (e) {
      if (e instanceof TriangleApiError && e.status === 403) setError("Your account has not been given access to a Triangle region yet.");
      else if (e instanceof TriangleApiError && e.status === 0) setError("You're offline or Triangle AI can't be reached.");
      else setError(e instanceof Error ? e.message : "Triangle AI is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Your Triangle region</Text>
      <Text style={styles.muted}>{session?.user.email}</Text>
      {loading && <ActivityIndicator style={{ marginTop: 24 }} />}
      {region && (
        <View style={styles.card}>
          <Text style={styles.region}>{region.regionId}</Text>
          <Text style={styles.muted}>Assigned by TriangleOS. Your chats are handled only in this region.</Text>
        </View>
      )}
      {model && (
        <View style={styles.card}>
          <Text style={styles.text}>{model.id} ({model.tier})</Text>
          <Text style={styles.muted}>{model.notice}</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        {error ? (
          <Pressable style={styles.button} onPress={load}><Text style={styles.buttonText}>Try again</Text></Pressable>
        ) : (
          <Pressable style={styles.button} onPress={onContinue} disabled={!region}><Text style={styles.buttonText}>Open chat</Text></Pressable>
        )}
        <Pressable style={[styles.button, styles.secondary]} onPress={signOut}><Text style={styles.buttonText}>Sign out</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  text: { color: colors.text },
  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
  region: { color: colors.region, fontSize: 20, fontWeight: "600" },
  card: { backgroundColor: colors.panel, borderRadius: 10, padding: 14, marginTop: 16 },
  error: { color: colors.error, marginTop: 16 },
  row: { flexDirection: "row", gap: 12, marginTop: 24 },
  button: { backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  secondary: { backgroundColor: colors.panel },
  buttonText: { color: "#fff", fontWeight: "600" },
});
