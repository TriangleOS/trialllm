import * as AppleAuthentication from "expo-apple-authentication";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { colors } from "../theme";

export default function SignInScreen() {
  const { signInWithGoogle, signInWithApple, appleAvailable, loading, error } = useAuth();
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Triangle LLM</Text>
      <Text style={styles.body}>Sign in with your TriangleOS account.</Text>
      {loading ? <ActivityIndicator /> : (
        <>
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={8}
              style={styles.apple}
              onPress={signInWithApple}
            />
          )}
          <Pressable style={styles.button} onPress={signInWithGoogle} accessibilityRole="button">
            <Text style={styles.buttonText}>Continue with Google</Text>
          </Pressable>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.notice}>Research preview. The Triangle model is not trained yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", marginBottom: 8 },
  body: { color: colors.muted, marginBottom: 24 },
  apple: { height: 48, marginBottom: 12 },
  button: { backgroundColor: colors.accent, padding: 14, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: colors.error, marginTop: 12 },
  notice: { color: colors.muted, fontSize: 11, marginTop: 32, textAlign: "center" },
});
