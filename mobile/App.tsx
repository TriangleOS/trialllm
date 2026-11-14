import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthProvider";
import ChatScreen from "./src/screens/ChatScreen";
import DeviceScreen from "./src/screens/DeviceScreen";
import RegionScreen from "./src/screens/RegionScreen";
import SignInScreen from "./src/screens/SignInScreen";
import { colors } from "./src/theme";

function ServerTab() {
  const { session, loading } = useAuth();
  const [screen, setScreen] = useState<"region" | "chat">("region");
  if (loading) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}><ActivityIndicator /></View>;
  if (!session) return <SignInScreen />;
  return screen === "chat"
    ? <ChatScreen onBack={() => setScreen("region")} />
    : <RegionScreen onContinue={() => setScreen("chat")} />;
}

/** "On this phone" works with no account. "Triangle server" uses llm.triangleos.com and needs sign-in. */
function Root() {
  const [tab, setTab] = useState<"device" | "server">("device");
  const Tab = ({ id, label }: { id: "device" | "server"; label: string }) => (
    <Pressable onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}
      style={{ flex: 1, padding: 10, borderBottomWidth: 2, borderBottomColor: tab === id ? colors.accent : "transparent" }}>
      <Text style={{ color: tab === id ? colors.text : colors.muted, textAlign: "center", fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row" }}>
        <Tab id="device" label="On this phone" />
        <Tab id="server" label="Triangle server" />
      </View>
      <View style={{ flex: 1 }}>{tab === "device" ? <DeviceScreen /> : <ServerTab />}</View>
    </View>
  );
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
