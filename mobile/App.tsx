import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthProvider";
import ChatScreen from "./src/screens/ChatScreen";
import RegionScreen from "./src/screens/RegionScreen";
import SignInScreen from "./src/screens/SignInScreen";
import { colors } from "./src/theme";

function Root() {
  const { session, loading } = useAuth();
  const [screen, setScreen] = useState<"region" | "chat">("region");
  if (loading) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}><ActivityIndicator /></View>;
  if (!session) return <SignInScreen />;
  return screen === "chat"
    ? <ChatScreen onBack={() => setScreen("region")} />
    : <RegionScreen onContinue={() => setScreen("chat")} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <AuthProvider><Root /></AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
