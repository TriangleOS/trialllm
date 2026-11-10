import type { Session } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
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
  /** iOS only. Apple requires it next to Google sign-in (App Store guideline 4.8). */
  signInWithApple: () => Promise<void>;
  appleAvailable: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Add this to Supabase Auth > URL Configuration > Redirect URLs: trianglellm://auth-callback */
export const REDIRECT_URL = Linking.createURL("auth-callback");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

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
    appleAvailable,
    async signInWithApple() {
      setError(null);
      if (!supabaseConfigured) {
        setError("Sign-in is not configured in this build.");
        return;
      }
      try {
        // Apple gets the hashed nonce; Supabase checks it against the raw one.
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
          nonce: hashedNonce,
        });
        if (!credential.identityToken) {
          setError("Apple sign-in did not complete.");
          return;
        }
        const { error: idError } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
        if (idError) setError("Apple sign-in did not complete.");
      } catch (e) {
        if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return;
        setError("Apple sign-in did not complete.");
      }
    },
    async signOut() {
      // Revokes the refresh token on the server and clears the Keychain/Keystore copy.
      await supabase.auth.signOut();
    },
  }), [session, loading, error, appleAvailable]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
