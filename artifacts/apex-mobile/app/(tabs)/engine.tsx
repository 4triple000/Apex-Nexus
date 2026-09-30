/**
 * Apex Engine in the phone app: start a game and plan it on the go.
 * Quick games play on the Apex website; mobile and computer games get a plan here
 * and a Unity / Unreal project you download on your computer.
 */
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Backdrop } from "@/components/glass/Glass";
import { MG, MGFont } from "@/constants/colors";
import { engineApi, type EngineKind, type EngineTarget, type EngineTemplate } from "@/services/api";

type Icon = { lib: "feather"; name: React.ComponentProps<typeof Feather>["name"] } | { lib: "mci"; name: React.ComponentProps<typeof MaterialCommunityIcons>["name"] };

const TARGETS: { id: EngineTarget; label: string; icon: React.ComponentProps<typeof Feather>["name"]; sub: string }[] = [
  { id: "apex", label: "Quick game", icon: "zap", sub: "Plays right away on phone and computer. You edit and play it in Apex." },
  { id: "mobile", label: "Mobile game", icon: "smartphone", sub: "For iPhone and Android, built with Unity. Plan it here, build it on your computer." },
  { id: "pc", label: "Computer game", icon: "monitor", sub: "AAA-style for PC and console with Unreal or Unity. Plan it on the go, build it at your computer." },
];

const TEMPLATES: { id: EngineTemplate; label: string; prompt: string; icon: Icon }[] = [
  { id: "fps", label: "3D shooter", prompt: "a 3D first person shooter", icon: { lib: "feather", name: "crosshair" } },
  { id: "topdown", label: "Top-down", prompt: "a top-down arena shooter", icon: { lib: "feather", name: "grid" } },
  { id: "platformer", label: "Platformer", prompt: "a fast neon platformer", icon: { lib: "mci", name: "run-fast" } },
  { id: "sports", label: "Sports", prompt: "an arcade basketball game", icon: { lib: "mci", name: "basketball" } },
  { id: "openworld", label: "Open world", prompt: "an open world city exploration game", icon: { lib: "mci", name: "city-variant-outline" } },
  { id: "survival", label: "Survival", prompt: "survive waves of enemies", icon: { lib: "mci", name: "waves" } },
];

const engineName = (e: EngineKind) => (e === "unity" ? "Unity" : e === "unreal" ? "Unreal" : "Apex");

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function EngineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [target, setTarget] = useState<EngineTarget>("mobile");
  const [pcEngine, setPcEngine] = useState<EngineKind>("unreal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projects = useQuery({ queryKey: ["engine-projects"], queryFn: engineApi.list, retry: 1 });

  const create = async (template?: EngineTemplate) => {
    const t = TEMPLATES.find((x) => x.id === template);
    const text = prompt.trim() || t?.prompt || "";
    if (!text) { setError("Describe your game or pick a template."); return; }
    setError(null);
    setBusy(true);
    try {
      const { project } = await engineApi.create({ prompt: text, target, engine: target === "pc" ? pcEngine : undefined, template });
      void qc.invalidateQueries({ queryKey: ["engine-projects"] });
      setPrompt("");
      router.navigate({ pathname: "/(tabs)/engine-project", params: { id: String(project.id) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the game. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const sel = TARGETS.find((x) => x.id === target)!;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130 }]} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Pressable accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(tabs)/games"))} style={[s.cc, { width: 40, height: 40 }]}>
            <Feather name="chevron-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>Apex Engine</Text>
            <Text style={s.sub}>Plan on your phone, build on your computer.</Text>
          </View>
        </View>

        <LinearGradient colors={["rgba(139,123,255,0.42)", "rgba(0,194,255,0.12)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="A rooftop shooter at night with drones and a jetpack…"
            placeholderTextColor={MG.ink3}
            multiline
            accessibilityLabel="Describe your game"
            style={s.input}
          />
          <Text style={s.label}>WHAT ARE YOU MAKING?</Text>
          <View style={s.seg} accessibilityRole="radiogroup">
            {TARGETS.map((t) => {
              const on = t.id === target;
              return (
                <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setTarget(t.id)} style={[s.segItem, on && s.segOn]}>
                  <Feather name={t.icon} size={15} color={on ? "#1C1640" : MG.ink2} />
                  <Text style={[s.segText, on && { color: "#1C1640" }]} numberOfLines={1}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.note}>{sel.sub}</Text>
          {target === "pc" ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }} accessibilityRole="radiogroup">
              {(["unreal", "unity"] as EngineKind[]).map((e) => {
                const on = e === pcEngine;
                return (
                  <Pressable key={e} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setPcEngine(e)} style={[s.pill, on && s.pillOn]}>
                    <Text style={[s.pillText, on && { color: "#1C1640" }]}>{engineName(e)}</Text>
                  </Pressable>
                );
              })}
              <Text style={[s.note, { flex: 1, minWidth: 140 }]}>{pcEngine === "unreal" ? "Best graphics. Needs a strong PC." : "Easier to start. Runs on most computers."}</Text>
            </View>
          ) : null}
          <Pressable onPress={() => create()} disabled={busy} style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
            <LinearGradient colors={["#7C6CFF", "#3BA8FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.go, busy && { opacity: 0.7 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Feather name="zap" size={16} color="#fff" />}
              <Text style={s.goText}>{busy ? "Writing your game plan…" : target === "apex" ? "Create with AI" : target === "mobile" ? "Plan my mobile game" : "Plan my computer game"}</Text>
            </LinearGradient>
          </Pressable>
          {error ? <Text style={s.error}>{error}</Text> : null}
        </LinearGradient>

        <Text style={[s.label, { marginTop: 8 }]}>OR START FROM A TEMPLATE</Text>
        <View style={s.grid}>
          {TEMPLATES.map((t) => (
            <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Start a ${t.label}`} onPress={() => create(t.id)} disabled={busy} style={s.tmpl}>
              {({ pressed }) => (
                <>
                  <View style={[s.cc, { width: 60, height: 60 }, pressed && { transform: [{ scale: 0.92 }] }]}>
                    {t.icon.lib === "feather" ? <Feather name={t.icon.name} size={24} color="#fff" /> : <MaterialCommunityIcons name={t.icon.name} size={26} color="#fff" />}
                  </View>
                  <Text style={s.tmplText}>{t.label}</Text>
                </>
              )}
            </Pressable>
          ))}
        </View>

        <Text style={[s.label, { marginTop: 8 }]}>YOUR PROJECTS</Text>
        {projects.isLoading ? (
          <ActivityIndicator color={MG.ink2} style={{ marginTop: 8 }} />
        ) : (projects.data?.length ?? 0) === 0 ? (
          <Text style={s.note}>Nothing yet. Your games show up here and on the Apex website when you sign in.</Text>
        ) : (
          projects.data!.map((p) => (
            <Pressable key={p.id} onPress={() => router.navigate({ pathname: "/(tabs)/engine-project", params: { id: String(p.id) } })} style={({ pressed }) => [s.row, pressed && { backgroundColor: "rgba(255,255,255,0.12)" }]}>
              <View style={[s.cc, { width: 42, height: 42 }]}>
                <Feather name={p.target === "apex" ? "zap" : p.target === "mobile" ? "smartphone" : "monitor"} size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={s.rowSub}>{p.target === "apex" ? "Quick game" : `${engineName(p.engine)} · ${p.progress.done} of ${p.progress.total} steps`} · {timeAgo(p.updatedAt)}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={MG.ink3} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 12, maxWidth: 640, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  h1: { fontFamily: MGFont.display, fontSize: 26, color: MG.ink },
  sub: { fontFamily: MGFont.medium, fontSize: 13, color: MG.ink2 },
  cc: { alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)" },
  card: { borderRadius: 28, padding: 14, gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  input: { minHeight: 84, borderRadius: 18, padding: 12, backgroundColor: "rgba(10,9,24,0.4)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", color: MG.ink, fontFamily: MGFont.medium, fontSize: 15, textAlignVertical: "top" },
  label: { fontFamily: MGFont.bold, fontSize: 11, letterSpacing: 1.3, color: MG.ink3 },
  seg: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 18, backgroundColor: "rgba(10,9,24,0.4)" },
  segItem: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 6 },
  segOn: { backgroundColor: "#fff" },
  segText: { fontFamily: MGFont.bold, fontSize: 11.5, color: MG.ink2 },
  note: { fontFamily: MGFont.medium, fontSize: 12.5, color: MG.ink2, lineHeight: 18 },
  pill: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  pillOn: { backgroundColor: "#fff", borderColor: "#fff" },
  pillText: { fontFamily: MGFont.bold, fontSize: 13, color: MG.ink2 },
  go: { height: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  goText: { fontFamily: MGFont.bold, fontSize: 15, color: "#fff" },
  error: { fontFamily: MGFont.medium, fontSize: 13, color: "#FFB3CF" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  tmpl: { width: "33.33%", alignItems: "center", gap: 7 },
  tmplText: { fontFamily: MGFont.semi, fontSize: 12, color: MG.ink2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  rowTitle: { fontFamily: MGFont.bold, fontSize: 14.5, color: MG.ink },
  rowSub: { fontFamily: MGFont.medium, fontSize: 12, color: MG.ink3, marginTop: 1 },
});
