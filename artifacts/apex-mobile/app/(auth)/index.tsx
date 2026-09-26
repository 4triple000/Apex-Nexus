/**
 * Login / Sign Up screen for Apex Mobile.
 * Clean, minimal, dark theme — inspired by ChatGPT and Apple's design language.
 */

import React, { useState, useRef } from "react";
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
import { authApi } from "@/services/api";

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
      fontFamily: "Inter_700Bold",
    },
    tagline: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: 6,
      fontFamily: "Inter_400Regular",
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
      fontFamily: "Inter_600SemiBold",
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
      fontFamily: "Inter_400Regular",
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
      fontFamily: "Inter_700Bold",
    },
    footerText: {
      textAlign: "center",
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    footerLink: {
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
