/**
 * Login / Sign Up screen for Apex Mobile.
 * Clean, minimal, dark theme — inspired by ChatGPT and Apple's design language.
 */

import React, { useState, useRef, useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import Svg, { Path } from "react-native-svg";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { authApi, parseGoogleReturn, googleErrorText } from "@/services/api";
import { Backdrop } from "@/components/glass/Glass";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);

  const isLogin = mode === "login";

  // Website version: show why a Google sign-in didn't finish (AuthContext handles the success case)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const w = window as unknown as { __apexGoogleError?: string };
    if (w.__apexGoogleError) {
      window.alert(googleErrorText(w.__apexGoogleError));
      delete w.__apexGoogleError;
    }
  }, []);

  const continueWithGoogle = async () => {
    if (Platform.OS === "web") {
      // Full-page redirect; AuthContext finishes sign-in when Google sends us back
      window.location.href = authApi.googleUrl(`${window.location.origin}/`);
      return;
    }
    setLoading(true);
    try {
      const returnTo = "apex-mobile://auth";
      const result = await WebBrowser.openAuthSessionAsync(authApi.googleUrl(returnTo), returnTo);
      if (result.type !== "success") return;
      const { code, error } = parseGoogleReturn(result.url);
      if (error || !code) { Alert.alert("Google sign-in", googleErrorText(error ?? "failed")); return; }
      const user = await authApi.googleExchange(code);
      await login(user);
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Google sign-in", err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter your email and password.");
      return;
    }
    if (!isLogin && password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const user = isLogin
        ? await authApi.login({ email: email.trim().toLowerCase(), password })
        : await authApi.register({ email: email.trim().toLowerCase(), password, username: username.trim() || undefined });

      await login({
        userId: user.userId,
        sessionId: user.sessionId,
        email: user.email,
        username: user.username,
        avatarEmoji: user.avatarEmoji,
        bio: user.bio,
      });
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoRing}>
              <Text style={styles.logoText}>⬡</Text>
            </View>
            <Text style={styles.brandName}>APEX</Text>
            <Text style={styles.tagline}>Your AI that remembers you</Text>
          </View>

          {/* Tab switcher */}
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, isLogin && styles.tabActive]}
              onPress={() => setMode("login")}
            >
              <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Sign In</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, !isLogin && styles.tabActive]}
              onPress={() => setMode("signup")}
            >
              <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Create Account</Text>
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {!isLogin && (
              <View style={styles.inputWrapper}>
                <Feather name="user" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  ref={usernameRef}
                  style={styles.input}
                  placeholder="Username (optional)"
                  placeholderTextColor={colors.mutedForeground}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Feather name="mail" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Feather name="lock" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>{isLogin ? "Sign In" : "Create Account"}</Text>
              )}
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.8 }]}
              onPress={continueWithGoogle}
              disabled={loading}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </Svg>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </Pressable>
          </View>

          <Text style={styles.footerText}>
            {isLogin ? "New to Apex? " : "Already have an account? "}
            <Text style={styles.footerLink} onPress={() => setMode(isLogin ? "signup" : "login")}>
              {isLogin ? "Create account" : "Sign in"}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 24,
      paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24,
      justifyContent: "center",
    },
    logoArea: {
      alignItems: "center",
      marginBottom: 40,
    },
    logoRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    logoText: {
      fontSize: 36,
      color: colors.primary,
    },
    brandName: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.foreground,
      letterSpacing: 6,
      fontFamily: "Sora_700Bold",
    },
    tagline: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: 6,
      fontFamily: "Manrope_400Regular",
    },
    tabRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 4,
      marginBottom: 24,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: colors.radius - 2,
      alignItems: "center",
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.mutedForeground,
      fontFamily: "Manrope_600SemiBold",
    },
    tabTextActive: {
      color: colors.primaryForeground,
    },
    form: {
      gap: 12,
      marginBottom: 24,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.input,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 52,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Manrope_400Regular",
    },
    eyeButton: {
      padding: 4,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    submitBtnPressed: {
      opacity: 0.85,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primaryForeground,
      fontFamily: "Sora_700Bold",
    },
    orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
    orLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
    orText: { fontSize: 11, letterSpacing: 1.2, color: colors.mutedForeground, fontFamily: "Manrope_700Bold" },
    googleBtn: {
      height: 52, borderRadius: colors.radius, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)",
    },
    googleBtnText: { fontSize: 15, color: colors.foreground, fontFamily: "Manrope_700Bold" },
    footerText: {
      textAlign: "center",
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Manrope_400Regular",
    },
    footerLink: {
      color: colors.primary,
      fontFamily: "Manrope_600SemiBold",
    },
  });
}
