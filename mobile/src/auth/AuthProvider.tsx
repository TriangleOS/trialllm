import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, supabaseConfigured } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Add this to Supabase Auth > URL Configuration > Redirect URLs: trianglellm://auth-callback */
export const REDIRECT_URL = Linking.createURL("auth-callback");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    loading,
    error,
    async signInWithGoogle() {
      setError(null);
      if (!supabaseConfigured) {
        setError("Sign-in is not configured in this build.");
        return;
      }
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
      });
      if (oauthError || !data.url) {
        setError("Could not start Google sign-in.");
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
      if (result.type !== "success") return; // user cancelled
      const code = new URL(result.url).searchParams.get("code");
      if (!code) {
        setError("Sign-in did not complete.");
        return;
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) setError("Sign-in did not complete.");
    },
    async signOut() {
      // Revokes the refresh token on the server and clears the Keychain/Keystore copy.
      await supabase.auth.signOut();
    },
  }), [session, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
