/**
 * AI Models in the phone app: every model Apex offers by category, and which are connected.
 * Chat models can be picked on Home; game tools open the Engine.
 */
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";

import { Backdrop } from "@/components/glass/Glass";
import { ELEVENLABS_PATH, ModelLogo, type ModelId } from "@/components/glass/ModelLogo";
import { MG, MGFont } from "@/constants/colors";
import { modelsApi, type CatalogModel, type ModelCategory } from "@/services/api";

const CHAT_LOGOS = new Set(["openai", "claude", "perplexity", "gemini", "grok", "deepseek", "mistral", "llama"]);
const GAME_TOOLS = new Set(["elevenlabs", "skybox", "meshy", "tripo", "scenario", "inworld"]);

function Logo({ m }: { m: CatalogModel }) {
  if (CHAT_LOGOS.has(m.id)) return <ModelLogo id={m.id as ModelId} size={22} color={m.color} />;
  if (m.id === "elevenlabs") return <Svg width={22} height={22} viewBox="0 0 24 24"><Path d={ELEVENLABS_PATH} fill={m.color} /></Svg>;
  return <Text style={{ fontFamily: MGFont.display, fontSize: 17, color: m.color }}>{m.name[0]}</Text>;
}

export default function ModelsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [cat, setCat] = useState<ModelCategory | "all">("all");
  const [q, setQ] = useState("");
  const data = useQuery({ queryKey: ["model-catalog"], queryFn: modelsApi.list, staleTime: 60_000, retry: 1 });

  const models = data.data?.models ?? [];
  const labels = data.data?.categories;
  const shown = useMemo(() => models.filter((m) =>
    (cat === "all" || m.category === cat) &&
    (!q.trim() || `${m.name} ${m.maker} ${m.tagline}`.toLowerCase().includes(q.trim().toLowerCase())),
  ), [models, cat, q]);
  const groups = (Object.keys(labels ?? {}) as ModelCategory[])
    .map((c) => ({ c, label: labels![c], items: shown.filter((m) => m.category === c) }))
    .filter((g) => g.items.length);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130 }]} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Pressable accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(tabs)"))} style={[s.cc, { width: 40, height: 40 }]}>
            <Feather name="chevron-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>AI Models</Text>
            <Text style={s.sub}>{models.length ? `${models.length} models · ${models.filter((m) => m.connected).length} connected` : "Chat, game worlds, images, voices and video"}</Text>
          </View>
        </View>

        <View style={s.search}>
          <Feather name="search" size={16} color={MG.ink3} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search models" placeholderTextColor={MG.ink3} accessibilityLabel="Search models" style={s.searchInput} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {([["all", "All"], ...Object.entries(labels ?? {})] as [ModelCategory | "all", string][]).map(([id, label]) => (
            <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: cat === id }} onPress={() => setCat(id)} style={[s.chip, cat === id && s.chipOn]}>
              <Text style={[s.chipText, cat === id && { color: "#1C1640" }]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {data.isLoading ? <ActivityIndicator color={MG.ink2} style={{ marginTop: 20 }} /> : null}
        {data.isError ? <Text style={s.sub}>Couldn't load the models. Pull down to try again.</Text> : null}

        {groups.map((g) => (
          <View key={g.c} style={{ gap: 8 }}>
            <Text style={s.label}>{g.label.toUpperCase()}</Text>
            {g.items.map((m) => (
              <View key={m.id} style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[s.logo, { shadowColor: m.color }]}><Logo m={m} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{m.name}</Text>
                    <Text style={s.maker}>{m.maker}</Text>
                  </View>
                  <View style={[s.pill, m.connected && s.pillOn]}>
                    <View style={[s.dot, { backgroundColor: m.connected ? "#4ADE80" : "rgba(255,255,255,0.35)" }]} />
                    <Text style={[s.pillText, { color: m.connected ? "#4ADE80" : MG.ink3 }]}>{m.connected ? "Connected" : "Not connected yet"}</Text>
                  </View>
                </View>
                <Text style={s.tagline}>{m.tagline}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {m.bestFor.map((b) => <Text key={b} style={s.tag}>{b}</Text>)}
                </View>
                {m.chat || GAME_TOOLS.has(m.id) ? (
                  <Pressable onPress={() => router.navigate(m.chat ? "/(tabs)" : "/(tabs)/engine")} style={s.action}>
                    <Feather name={m.chat ? "message-circle" : "play-circle"} size={14} color="#1C1640" />
                    <Text style={s.actionText}>{m.chat ? "Chat on Home" : m.id === "elevenlabs" ? "Voice your game characters" : "Use in the Engine"}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 14, maxWidth: 640, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  h1: { fontFamily: MGFont.display, fontSize: 26, color: MG.ink },
  sub: { fontFamily: MGFont.medium, fontSize: 13, color: MG.ink2 },
  cc: { alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)" },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 44, borderRadius: 22, paddingHorizontal: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  searchInput: { flex: 1, color: MG.ink, fontFamily: MGFont.medium, fontSize: 15 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  chipOn: { backgroundColor: "#fff", borderColor: "#fff" },
  chipText: { fontFamily: MGFont.semi, fontSize: 13, color: MG.ink2 },
  label: { fontFamily: MGFont.bold, fontSize: 11, letterSpacing: 1.3, color: MG.ink3, marginTop: 4 },
  card: { borderRadius: 24, padding: 14, gap: 10, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  logo: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(24,20,48,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", shadowOpacity: 0.4, shadowRadius: 12 },
  name: { fontFamily: MGFont.bold, fontSize: 15, color: MG.ink },
  maker: { fontFamily: MGFont.medium, fontSize: 12, color: MG.ink3 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  pillOn: { backgroundColor: "rgba(74,222,128,0.12)", borderColor: "rgba(74,222,128,0.3)" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: MGFont.bold, fontSize: 11 },
  tagline: { fontFamily: MGFont.medium, fontSize: 13.5, color: MG.ink2, lineHeight: 19 },
  tag: { fontFamily: MGFont.semi, fontSize: 11, color: MG.ink2, backgroundColor: "rgba(255,255,255,0.07)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: "hidden" },
  action: { alignSelf: "flex-start", height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontFamily: MGFont.bold, fontSize: 12.5, color: "#1C1640" },
});
