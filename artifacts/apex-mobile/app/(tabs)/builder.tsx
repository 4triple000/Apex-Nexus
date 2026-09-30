/**
 * Builder — describe something and Apex builds it (AI Studio on the server).
 * Shows the result, lets you ask for changes, and lists your projects and prompts.
 */
import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Backdrop, Glass } from "@/components/glass/Glass";
import { UsagePill } from "@/components/glass/UsagePill";
import { PreviewFrame } from "@/components/PreviewFrame";
import { MG, MGFont } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { recordPrompt, usePromptLibrary } from "@/lib/promptLibrary";
import { studioApi, type StudioBuild } from "@/services/api";

const TYPES: { id: string; label: string; icon: React.ComponentProps<typeof Feather>["name"]; prefix: string }[] = [
  { id: "app",        label: "App",        icon: "smartphone", prefix: "A mobile-friendly app: " },
  { id: "website",    label: "Website",    icon: "globe",      prefix: "A website: " },
  { id: "game",       label: "Game",       icon: "play",       prefix: "A browser game: " },
  { id: "bot",        label: "Bot",        icon: "cpu",        prefix: "A chatbot: " },
  { id: "automation", label: "Automation", icon: "git-branch", prefix: "An automation workflow: " },
];

const IDEAS = ["A habit tracker with streaks", "A landing page for my brand", "A space shooter with power-ups"];

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function BuilderScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const library = usePromptLibrary("build");
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState("app");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StudioBuild | null>(null);
  const [change, setChange] = useState("");
  const [changeNote, setChangeNote] = useState<string | null>(null);

  const projects = useQuery({
    queryKey: ["studio-projects", user?.sessionId],
    enabled: !!user?.sessionId,
    queryFn: () => studioApi.projects(user!.sessionId),
  });

  const build = async (text = prompt) => {
    const t = text.trim();
    if (!t || busy || !user) return;
    setBusy(true); setError(null); setResult(null); setChangeNote(null);
    recordPrompt(t, "build");
    try {
      const prefix = TYPES.find((x) => x.id === type)?.prefix ?? "";
      const r = await studioApi.generate(prefix + t, user.sessionId);
      setResult(r);
      setPrompt("");
      queryClient.invalidateQueries({ queryKey: ["studio-projects"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The build didn't finish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const applyChange = async () => {
    if (!result || !change.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await studioApi.edit(result.projectId, change.trim(), user!.sessionId);
      setChangeNote(r.summary || `${r.changedFiles.length} files updated`);
      if (r.previewHtml) setResult((prev) => (prev ? { ...prev, previewHtml: r.previewHtml } : prev));
      setChange("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const openProject = async (id: number) => {
    if (!user || busy) return;
    setBusy(true); setError(null); setChangeNote(null);
    try {
      setResult(await studioApi.project(id, user.sessionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that project.");
    } finally {
      setBusy(false);
    }
  };

  const promptRows = [
    ...library.saved.slice(0, 3).map((p) => ({ ...p, saved: true })),
    ...library.history.filter((p) => !library.isSaved(p.text)).slice(0, 3).map((p) => ({ ...p, saved: false })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: MG.bg }}>
      <Backdrop />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: Platform.OS === "web" ? 16 : insets.top + 6, paddingHorizontal: 16, paddingBottom: 130, gap: 16 }}
      >
        <View style={s.headRow}>
          <View>
            <Text style={s.title}>Builder</Text>
            <Text style={s.sub}>Describe it. Apex builds it.</Text>
          </View>
          <UsagePill />
        </View>

        <Glass radius={28} style={s.card}>
          <LinearGradient pointerEvents="none" colors={["rgba(139,123,255,0.4)", "rgba(0,194,255,0.12)"]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="A social app for dog lovers with real-time chat…"
            placeholderTextColor={MG.ink3}
            multiline
            style={s.input}
            accessibilityLabel="Describe what you want to build"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TYPES.map((t) => {
              const on = t.id === type;
              return (
                <Pressable key={t.id} onPress={() => setType(t.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[s.chip, on && s.chipOn]}>
                  <Feather name={t.icon} size={13} color={on ? "#120F2A" : MG.ink2} />
                  <Text style={[s.chipText, on && { color: "#120F2A" }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={() => build()} disabled={!prompt.trim() || busy} style={({ pressed }) => [{ opacity: !prompt.trim() || busy ? 0.55 : 1 }, pressed && { transform: [{ scale: 0.98 }] }]}>
            <LinearGradient colors={["#7C6CFF", "#3BA8FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.buildBtn}>
              {busy && !result ? <ActivityIndicator color="#fff" /> : <Feather name="zap" size={16} color="#fff" />}
              <Text style={s.buildText}>{busy && !result ? "Building…" : "Build with Apex"}</Text>
            </LinearGradient>
          </Pressable>
        </Glass>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {result ? (
          <Glass radius={24} style={{ padding: 16, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={s.projIcon}><Feather name="check" size={18} color="#86EFAC" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.resultTitle}>{result.plan.project_name}</Text>
                <Text style={s.small}>{result.files.length} files built</Text>
              </View>
            </View>
            {result.summary ? <Text style={s.body}>{result.summary}</Text> : null}
            {result.previewHtml ? <PreviewFrame html={result.previewHtml} /> : null}
            {changeNote ? <Text style={[s.body, { color: "#86EFAC" }]}>✓ {changeNote}</Text> : null}
            <View style={s.changeRow}>
              <TextInput value={change} onChangeText={setChange} placeholder="Ask for a change…" placeholderTextColor={MG.ink3} style={s.changeInput} onSubmitEditing={applyChange} />
              <Pressable onPress={applyChange} disabled={!change.trim() || busy} accessibilityLabel="Apply change" style={[s.send, (!change.trim() || busy) && { opacity: 0.5 }]}>
                {busy ? <ActivityIndicator color="#120F2A" size="small" /> : <Feather name="arrow-up" size={16} color="#120F2A" />}
              </Pressable>
            </View>
          </Glass>
        ) : null}

        {!prompt.trim() && !result ? (
          <View style={{ gap: 8 }}>
            <Text style={s.label}>Try an idea</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {IDEAS.map((i) => (
                <Pressable key={i} onPress={() => setPrompt(i)} style={s.idea}><Text style={s.ideaText}>{i}</Text></Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {promptRows.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={s.label}>Your prompts</Text>
            <Glass radius={22}>
              {promptRows.map((p, i) => (
                <View key={p.text} style={[s.promptRow, i > 0 && s.divider]}>
                  <Feather name={p.saved ? "star" : "clock"} size={14} color={p.saved ? "#FFD479" : MG.ink3} />
                  <Pressable onPress={() => setPrompt(p.text)} style={{ flex: 1 }}>
                    <Text style={s.promptText} numberOfLines={1}>{p.text}</Text>
                  </Pressable>
                  <Pressable onPress={() => library.toggleSaved(p.text)} hitSlop={8} accessibilityLabel={p.saved ? "Remove from saved" : "Save prompt"}>
                    <Feather name="star" size={15} color={p.saved ? "#FFD479" : MG.ink3} />
                  </Pressable>
                </View>
              ))}
            </Glass>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={s.label}>Your projects</Text>
          {projects.isError ? (
            <Text style={s.small}>Couldn't load your projects.</Text>
          ) : (projects.data?.length ?? 0) === 0 && !projects.isLoading ? (
            <Glass radius={22} style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Feather name="folder" size={20} color={MG.ink2} />
              <Text style={s.body}>Nothing built yet. Your first build shows up here.</Text>
            </Glass>
          ) : (
            (projects.data ?? []).slice(0, 10).map((p) => (
              <Pressable key={p.id} onPress={() => openProject(p.id)} accessibilityLabel={`Open ${p.title}`}>
              <Glass radius={22} style={s.projRow}>
                <View style={s.projIcon}><Feather name="zap" size={17} color="#C9C2FF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.projTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={s.small}>{p.appType ? `${p.appType} · ` : ""}{timeAgo(p.updatedAt)}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={MG.ink3} />
              </Glass>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  title: { color: MG.ink, fontSize: 28, fontFamily: MGFont.display, letterSpacing: -0.5 },
  sub: { color: MG.ink2, fontSize: 13.5, fontFamily: MGFont.medium, marginTop: 2 },
  card: { padding: 16, gap: 12 },
  input: { minHeight: 84, color: MG.ink, fontSize: 15, fontFamily: MGFont.body, backgroundColor: "rgba(10,9,24,0.35)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", padding: 12, textAlignVertical: "top" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 13, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  chipOn: { backgroundColor: "rgba(255,255,255,0.92)", borderColor: "transparent" },
  chipText: { color: MG.ink2, fontSize: 13, fontFamily: MGFont.semi },
  buildBtn: { height: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buildText: { color: "#fff", fontSize: 15, fontFamily: MGFont.bold },
  error: { color: "#FCA5A5", fontSize: 13, fontFamily: MGFont.medium },
  resultTitle: { color: MG.ink, fontSize: 17, fontFamily: MGFont.display },
  body: { color: MG.ink2, fontSize: 13.5, fontFamily: MGFont.body, lineHeight: 19, flex: 1 },
  small: { color: MG.ink3, fontSize: 12, fontFamily: MGFont.body },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  changeInput: { flex: 1, height: 42, borderRadius: 21, paddingHorizontal: 14, color: MG.ink, fontFamily: MGFont.body, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  label: { color: MG.ink3, fontSize: 11, fontFamily: MGFont.bold, letterSpacing: 1.1, textTransform: "uppercase" },
  idea: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  ideaText: { color: MG.ink2, fontSize: 12.5, fontFamily: MGFont.medium },
  promptRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  divider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  promptText: { color: MG.ink, fontSize: 13.5, fontFamily: MGFont.body },
  projRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  projIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(139,123,255,0.22)", alignItems: "center", justifyContent: "center" },
  projTitle: { color: MG.ink, fontSize: 14.5, fontFamily: MGFont.semi },
});
