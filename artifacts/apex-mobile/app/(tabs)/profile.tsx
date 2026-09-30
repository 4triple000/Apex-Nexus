/**
 * Profile Screen — user info, what Apex remembers about you, logout.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Backdrop } from "@/components/glass/Glass";
import { memoryApi, WEB_APP_URL, type MemoryItem } from "@/services/api";

const CATEGORY_EMOJI: Record<string, string> = {
  goal: "🎯",
  interest: "💡",
  fact: "📌",
  preference: "⭐",
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [loadingMemory, setLoadingMemory] = useState(true);

  useEffect(() => {
    if (!user) return;
    memoryApi.get(user.userId)
      .then((res) => setMemory(res.memory))
      .catch(() => {})
      .finally(() => setLoadingMemory(false));
  }, [user]);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)");
        },
      },
    ]);
  };

  if (!user) return null;

  const topPad = Platform.OS === "web" ? 67 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 34 : Math.max(insets.bottom, 16);

  const memberSince = new Date(user?.userId ? Date.now() - (user.userId * 10000) : Date.now());

  const styles = makeStyles(colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Backdrop />
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Profile</Text>
      </View>

      {/* User card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarEmoji}>{user.avatarEmoji}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: colors.foreground }]}>{user.username}</Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>{user.email}</Text>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.tierText, { color: colors.primary }]}>Free</Text>
        </View>
      </View>

      {/* Avatar customizer (opens on the website, where the 3D editor lives) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Customize your avatar"
        onPress={() => void WebBrowser.openBrowserAsync(`${WEB_APP_URL}/avatar`)}
        style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[styles.avatarCircle, { backgroundColor: "rgba(236,72,153,0.25)" }]}>
          <Text style={styles.avatarEmoji}>🧬</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: colors.foreground }]}>Customize your avatar</Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>Change how your 3D avatar looks and sounds</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </Pressable>

      {/* Connectors */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Connectors"
        onPress={() => router.push("/(tabs)/connectors")}
        style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[styles.avatarCircle, { backgroundColor: "rgba(74,222,128,0.2)" }]}>
          <Text style={styles.avatarEmoji}>🔌</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: colors.foreground }]}>Connectors</Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>Use your own AI accounts and apps in Apex</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </Pressable>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{memory.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Memories</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>∞</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Chats</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>AI</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Model</Text>
        </View>
      </View>

      {/* Memory section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What Apex knows about you</Text>
          {memory.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.countBadgeText, { color: colors.primaryForeground }]}>{memory.length}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
          Built automatically from your conversations
        </Text>

        {loadingMemory ? (
          <View style={styles.memoryLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : memory.length === 0 ? (
          <View style={[styles.emptyMemory, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyMemoryIcon, { color: colors.mutedForeground }]}>🧠</Text>
            <Text style={[styles.emptyMemoryText, { color: colors.mutedForeground }]}>
              Start chatting and Apex will remember your goals, interests, and preferences.
            </Text>
          </View>
        ) : (
          <View style={styles.memoryList}>
            {memory.map((item) => (
              <View key={item.id} style={[styles.memoryItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.memoryEmoji}>{CATEGORY_EMOJI[item.category] ?? "💭"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memoryValue, { color: colors.foreground }]}>{item.value}</Text>
                  <Text style={[styles.memoryCategory, { color: colors.mutedForeground }]}>{item.category}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Sign out */}
      <Pressable
        style={({ pressed }) => [styles.signOutBtn, { borderColor: colors.destructive }, pressed && { opacity: 0.7 }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={16} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign Out</Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    headerRow: { paddingHorizontal: 20, paddingBottom: 20 },
    screenTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Sora_700Bold" },
    card: {
      marginHorizontal: 16, borderRadius: 16, padding: 16, borderWidth: 1,
      flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12,
    },
    avatarCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
    avatarEmoji: { fontSize: 26 },
    userInfo: { flex: 1 },
    username: { fontSize: 17, fontWeight: "700", fontFamily: "Sora_700Bold" },
    email: { fontSize: 13, marginTop: 2, fontFamily: "Manrope_400Regular" },
    tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tierText: { fontSize: 12, fontWeight: "700", fontFamily: "Sora_700Bold" },
    statsRow: { flexDirection: "row", marginHorizontal: 16, gap: 8, marginBottom: 24 },
    statCard: {
      flex: 1, borderRadius: 14, padding: 14, borderWidth: 1, alignItems: "center",
    },
    statValue: { fontSize: 20, fontWeight: "700", fontFamily: "Sora_700Bold" },
    statLabel: { fontSize: 11, marginTop: 2, fontFamily: "Manrope_400Regular" },
    section: { paddingHorizontal: 16, marginBottom: 24 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    sectionTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Sora_700Bold" },
    countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    countBadgeText: { fontSize: 12, fontWeight: "700" },
    sectionSub: { fontSize: 13, marginBottom: 14, fontFamily: "Manrope_400Regular" },
    memoryLoading: { paddingVertical: 24, alignItems: "center" },
    emptyMemory: { borderRadius: 14, padding: 20, borderWidth: 1, alignItems: "center", gap: 10 },
    emptyMemoryIcon: { fontSize: 32 },
    emptyMemoryText: { fontSize: 14, textAlign: "center", lineHeight: 20, fontFamily: "Manrope_400Regular" },
    memoryList: { gap: 8 },
    memoryItem: {
      borderRadius: 12, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "flex-start", gap: 12,
    },
    memoryEmoji: { fontSize: 18, marginTop: 1 },
    memoryValue: { fontSize: 14, lineHeight: 20, fontFamily: "Manrope_400Regular" },
    memoryCategory: { fontSize: 11, marginTop: 2, textTransform: "capitalize", fontFamily: "Manrope_400Regular" },
    signOutBtn: {
      marginHorizontal: 16, borderRadius: 14, borderWidth: 1, height: 50,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    },
    signOutText: { fontSize: 15, fontWeight: "600", fontFamily: "Manrope_600SemiBold" },
  });
}
