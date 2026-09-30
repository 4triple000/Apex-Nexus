/**
 * A game in the Apex Engine, on the phone.
 * Mobile and computer games: edit the plan, ask the AI to change it, tick off the checklist,
 * and send yourself the link to download the Unity / Unreal project on your computer.
 * Quick games open in the Engine on the Apex website to play and edit.
 */
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Backdrop } from "@/components/glass/Glass";
import { MG, MGFont } from "@/constants/colors";
import { engineApi, WEB_APP_URL, type CameraStyle, type EngineKind, type GamePlan, type GameProject } from "@/services/api";

type Section = "overview" | "loop" | "controls" | "mechanics" | "levels" | "characters" | "art" | "checklist";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "loop", label: "Core loop" }, { id: "controls", label: "Controls" },
  { id: "mechanics", label: "Mechanics" }, { id: "levels", label: "Levels" }, { id: "characters", label: "Characters" },
  { id: "art", label: "Art & sound" }, { id: "checklist", label: "Checklist" },
];
const CAMERAS: CameraStyle[] = ["First person", "Third person", "Top-down", "Side view"];
const CHIPS = ["Add a boss fight", "Make it co-op", "Simplify it for a solo developer", "Add a second level"];
const engineName = (e: EngineKind) => (e === "unity" ? "Unity" : e === "unreal" ? "Unreal" : "Apex");

interface Msg { from: "me" | "ai"; text: string; error?: boolean }

export default function EngineProjectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Number(idParam);
  const query = useQuery({ queryKey: ["engine-project", id], queryFn: () => engineApi.get(id), enabled: Number.isInteger(id), retry: 1 });
  const [project, setProject] = useState<GameProject | null>(null);
  const [tab, setTab] = useState<"plan" | "ai" | "build">("plan");
  const [section, setSection] = useState<Section>("overview");
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = useRef<Partial<GameProject>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A new id (opened from the list) replaces what's on screen
  useEffect(() => { setProject(null); setMsgs([]); setTab("plan"); setSection("overview"); }, [id]);
  useEffect(() => { if (query.data && (!project || project.id !== query.data.project.id)) setProject(query.data.project); }, [query.data, project]);

  const flush = useCallback(async () => {
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    setSaved("saving");
    try {
      const next = await engineApi.update(id, body);
      if (body.engine) setProject(next);
      setSaved("saved");
      void qc.invalidateQueries({ queryKey: ["engine-projects"] });
    } catch {
      setSaved("error");
    }
  }, [id, qc]);

  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, [flush]);

  const change = (patch: Partial<Pick<GameProject, "title" | "plan" | "engine">>, now = false) => {
    setProject((p) => (p ? { ...p, ...patch } : p));
    pending.current = { ...pending.current, ...patch };
    setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), now ? 0 : 800);
  };

  const ask = async (t: string) => {
    const v = t.trim();
    if (!v || busy) return;
    setText("");
    setMsgs((m) => [...m, { from: "me", text: v }]);
    setBusy(true);
    try {
      await flush();
      const r = await engineApi.askPlan(id, v);
      setProject(r.project);
      setMsgs((m) => [...m, { from: "ai", text: r.reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "ai", text: e instanceof Error ? e.message : "Something went wrong. Try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const link = `${WEB_APP_URL}/game-engine/${id}`;
  const sendToComputer = async () => {
    try {
      await Share.share(Platform.OS === "ios" ? { url: link, message: "Download my game project from Apex" } : { message: `Download my game project from Apex: ${link}` });
    } catch { /* cancelled */ }
  };

  const remove = async () => {
    try {
      await engineApi.remove(id);
      void qc.invalidateQueries({ queryKey: ["engine-projects"] });
      router.navigate("/(tabs)/engine");
    } catch { setSaved("error"); }
  };

  const back = () => (router.canGoBack() ? router.back() : router.navigate("/(tabs)/engine"));

  if (query.isError) {
    return (
      <Screen top={insets.top}>
        <Text style={[s.note, { textAlign: "center", marginTop: 40 }]}>{query.error instanceof Error ? query.error.message : "Couldn't open this game."}</Text>
        <Pressable onPress={back} style={[s.white, { alignSelf: "center", paddingHorizontal: 20, marginTop: 12 }]}><Text style={s.whiteText}>Back to the Engine</Text></Pressable>
      </Screen>
    );
  }
  if (!project) return <Screen top={insets.top}><ActivityIndicator color={MG.ink2} style={{ marginTop: 60 }} /></Screen>;

  const plan = project.plan;
  const planned = project.target !== "apex";
  const set = (p: Partial<GamePlan>) => plan && change({ plan: { ...plan, ...p } });
  const done = plan?.checklist.filter((c) => c.done).length ?? 0;

  return (
    <Screen top={insets.top}>
      <View style={s.bar}>
        <Pressable accessibilityLabel="Back" onPress={back} style={[s.cc, { width: 38, height: 38 }]}><Feather name="chevron-left" size={19} color="#fff" /></Pressable>
        <TextInput value={project.title} onChangeText={(t) => change({ title: t.slice(0, 80) || "Untitled game" })} accessibilityLabel="Game name" style={s.title} />
        <View accessibilityLabel={saved === "saving" ? "Saving" : saved === "error" ? "Not saved" : "Saved"} style={[s.dot, { backgroundColor: saved === "error" ? MG.pink : saved === "saving" ? "#FFD166" : "#4ADE80" }]} />
        <Pressable accessibilityLabel={confirmDelete ? "Yes, delete this game" : "Delete game"} onPress={() => (confirmDelete ? remove() : setConfirmDelete(true))} style={[s.cc, { width: 38, height: 38 }, confirmDelete && { borderColor: MG.pink }]}>
          <Feather name="trash-2" size={15} color={confirmDelete ? MG.pink : "#fff"} />
        </Pressable>
      </View>
      {confirmDelete ? <Text style={[s.note, { color: "#FFB3CF", paddingHorizontal: 16 }]}>Tap the bin again to delete this game.</Text> : null}

      {!planned ? (
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 130 }]}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Quick game</Text>
            <Text style={s.note}>Quick games play right away. Open it in the Engine to press Play, change it with the AI helper, and publish it to Apex Games.</Text>
            <Pressable onPress={() => void WebBrowser.openBrowserAsync(link)} style={s.white}><Feather name="play" size={15} color="#1C1640" /><Text style={s.whiteText}>Open in the Engine</Text></Pressable>
          </View>
          {plan ? <View style={s.card}><Text style={s.label}>PITCH</Text><Text style={s.bodyText}>{plan.pitch}</Text></View> : null}
        </ScrollView>
      ) : (
        <>
          <View style={s.seg}>
            {(["plan", "ai", "build"] as const).map((t) => (
              <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={[s.segItem, tab === t && s.segOn]}>
                <Text style={[s.segText, tab === t && { color: "#1C1640" }]}>{t === "plan" ? "Plan" : t === "ai" ? "AI" : "Build"}</Text>
              </Pressable>
            ))}
          </View>

          {tab === "plan" && plan ? (
            <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 130 }]} keyboardShouldPersistTaps="handled">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {SECTIONS.map((x) => (
                  <Pressable key={x.id} onPress={() => setSection(x.id)} style={[s.pill, section === x.id && s.pillOn]}>
                    <Text style={[s.pillText, section === x.id && { color: "#1C1640" }]}>{x.label}{x.id === "checklist" ? ` ${done}/${plan.checklist.length}` : ""}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {section === "overview" ? (
                <>
                  <Field label="PITCH"><TextInput multiline value={plan.pitch} onChangeText={(v) => set({ pitch: v.slice(0, 1200) })} style={[s.input, { minHeight: 96 }]} /></Field>
                  <Field label="GENRE"><TextInput value={plan.genre} onChangeText={(v) => set({ genre: v.slice(0, 80) })} style={s.input} /></Field>
                  <Field label="CAMERA">
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {CAMERAS.map((c) => (
                        <Pressable key={c} onPress={() => set({ camera: c })} style={[s.pill, plan.camera === c && s.pillOn]}><Text style={[s.pillText, plan.camera === c && { color: "#1C1640" }]}>{c}</Text></Pressable>
                      ))}
                    </View>
                  </Field>
                  <Field label="PLATFORMS"><Text style={s.bodyText}>{plan.platforms.join(", ")}</Text></Field>
                </>
              ) : null}
              {section === "loop" ? <Field label="CORE LOOP"><TextInput multiline value={plan.coreLoop} onChangeText={(v) => set({ coreLoop: v.slice(0, 1200) })} style={[s.input, { minHeight: 130 }]} /></Field> : null}
              {section === "controls" ? <List label="CONTROLS" items={plan.controls} onChange={(controls) => set({ controls })} /> : null}
              {section === "mechanics" ? <List label="MECHANICS" items={plan.mechanics} onChange={(mechanics) => set({ mechanics })} /> : null}
              {section === "levels" ? <Pairs label="LEVELS" a="Name" b="Goal" items={plan.levels.map((l) => [l.name, l.goal])} onChange={(v) => set({ levels: v.map(([name, goal]) => ({ name, goal })) })} /> : null}
              {section === "characters" ? <Pairs label="CHARACTERS" a="Name" b="Role" items={plan.characters.map((c) => [c.name, c.role])} onChange={(v) => set({ characters: v.map(([name, role]) => ({ name, role })) })} /> : null}
              {section === "art" ? (
                <>
                  <Field label="ART STYLE"><TextInput multiline value={plan.artStyle} onChangeText={(v) => set({ artStyle: v.slice(0, 600) })} style={[s.input, { minHeight: 80 }]} /></Field>
                  <Field label="SOUND AND MUSIC"><TextInput multiline value={plan.audio} onChangeText={(v) => set({ audio: v.slice(0, 600) })} style={[s.input, { minHeight: 80 }]} /></Field>
                </>
              ) : null}
              {section === "checklist" ? (
                <View style={{ gap: 6 }}>
                  {plan.checklist.map((c, i) => (
                    <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: c.done }} onPress={() => set({ checklist: plan.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
                      style={[s.check, c.done && { backgroundColor: "rgba(74,222,128,0.1)" }]}>
                      <View style={[s.cc, { width: 24, height: 24 }, c.done && s.on]}>{c.done ? <Feather name="check" size={13} color="#16a34a" /> : null}</View>
                      <Text style={[s.bodyText, { flex: 1 }, c.done && { textDecorationLine: "line-through", color: MG.ink2 }]}>{c.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          {tab === "ai" ? (
            <View style={[s.body, { flex: 1, paddingBottom: insets.bottom + 110 }]}>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }}>
                {msgs.length === 0 && !busy ? <Text style={s.note}>Ask for any change to your plan in plain words, or tap a suggestion.</Text> : null}
                {msgs.map((m, i) => (
                  <View key={i} style={[s.msg, m.from === "me" ? s.msgMe : s.msgAi, m.error && { backgroundColor: "rgba(255,79,163,0.14)" }]}>
                    <Text style={[s.msgText, m.error && { color: "#FFB3CF" }]}>{m.text}</Text>
                  </View>
                ))}
                {busy ? <View style={[s.msg, s.msgAi]}><Text style={[s.msgText, { color: MG.ink3 }]}>Working on it…</Text></View> : null}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
                {CHIPS.map((c) => <Pressable key={c} onPress={() => ask(c)} disabled={busy} style={s.pill}><Text style={s.pillText}>{c}</Text></Pressable>)}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput value={text} onChangeText={setText} onSubmitEditing={() => ask(text)} placeholder="Ask the AI to change your plan…" placeholderTextColor={MG.ink3} accessibilityLabel="Ask the AI helper" style={[s.input, { flex: 1, height: 42, borderRadius: 21 }]} />
                <Pressable accessibilityLabel="Send" onPress={() => ask(text)} disabled={busy || !text.trim()} style={[s.cc, s.on, { width: 42, height: 42, opacity: busy || !text.trim() ? 0.5 : 1 }]}><Feather name="send" size={16} color="#7A6BFF" /></Pressable>
              </View>
            </View>
          ) : null}

          {tab === "build" && plan ? (
            <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 130 }]}>
              <View style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[s.cc, { width: 40, height: 40 }]}><Feather name={project.target === "mobile" ? "smartphone" : "monitor"} size={17} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{project.target === "mobile" ? "Mobile game" : "Computer game"} · {engineName(project.engine)}</Text>
                    <Text style={s.small}>{plan.platforms.join(", ")}</Text>
                  </View>
                </View>
                {project.target === "pc" ? (
                  <View style={[s.seg, { marginHorizontal: 0 }]}>
                    {(["unreal", "unity"] as EngineKind[]).map((e) => (
                      <Pressable key={e} onPress={() => e !== project.engine && change({ engine: e }, true)} style={[s.segItem, project.engine === e && s.segOn]}>
                        <Text style={[s.segText, project.engine === e && { color: "#1C1640" }]}>{engineName(e)}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                    <Text style={s.small}>Plan progress</Text><Text style={s.small}>{done} of {plan.checklist.length}</Text>
                  </View>
                  <View style={s.track}><View style={[s.fill, { width: `${plan.checklist.length ? Math.round((done / plan.checklist.length) * 100) : 0}%` }]} /></View>
                </View>
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>Build it on your computer</Text>
                <Text style={s.note}>Your plan is saved to your account. On your computer:</Text>
                {[
                  project.engine === "unity" ? "Install Unity Hub and Unity 6 (free)." : "Install Unreal Engine 5 from the Epic Games Launcher, plus Visual Studio.",
                  `Open ${WEB_APP_URL.replace(/^https?:\/\//, "")} and sign in.`,
                  "Go to Games → Create → this project, and tap Download.",
                  project.engine === "unity" ? "Add the unzipped folder in Unity Hub and press Play." : "Double-click the .uproject file and press Play.",
                ].map((step, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 10 }}>
                    <Text style={[s.small, { width: 16, color: MG.ink2 }]}>{i + 1}.</Text>
                    <Text style={[s.bodyText, { flex: 1 }]}>{step}</Text>
                  </View>
                ))}
                <Pressable onPress={sendToComputer} style={s.white}><Feather name="send" size={15} color="#1C1640" /><Text style={s.whiteText}>Send the link to my computer</Text></Pressable>
                <Text selectable style={[s.small, { textAlign: "center" }]}>{link}</Text>
              </View>
            </ScrollView>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Screen({ children, top }: { children: React.ReactNode; top: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <View style={{ flex: 1, paddingTop: top + 8 }}>{children}</View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text>{children}</View>;
}

function List({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <Field label={label}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={it} onChangeText={(v) => onChange(items.map((x, j) => (j === i ? v.slice(0, 240) : x)))} accessibilityLabel={`${label} ${i + 1}`} style={[s.input, { flex: 1 }]} />
          <Pressable accessibilityLabel={`Remove ${i + 1}`} onPress={() => onChange(items.filter((_, j) => j !== i))} style={[s.cc, { width: 40, height: 40 }]}><Feather name="trash-2" size={14} color="#fff" /></Pressable>
        </View>
      ))}
      {items.length < 16 ? <Pressable onPress={() => onChange([...items, ""])} style={s.add}><Feather name="plus" size={14} color={MG.ink2} /><Text style={s.pillText}>Add</Text></Pressable> : null}
    </Field>
  );
}

function Pairs({ label, a, b, items, onChange }: { label: string; a: string; b: string; items: [string, string][]; onChange: (v: [string, string][]) => void }) {
  return (
    <Field label={label}>
      {items.map(([x, y], i) => (
        <View key={i} style={[s.card, { padding: 10, gap: 6 }]}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={x} placeholder={a} placeholderTextColor={MG.ink3} onChangeText={(v) => onChange(items.map((p, j) => (j === i ? [v.slice(0, 80), p[1]] : p)))} style={[s.input, { flex: 1, fontFamily: MGFont.bold }]} />
            <Pressable accessibilityLabel={`Remove ${i + 1}`} onPress={() => onChange(items.filter((_, j) => j !== i))} style={[s.cc, { width: 40, height: 40 }]}><Feather name="trash-2" size={14} color="#fff" /></Pressable>
          </View>
          <TextInput value={y} placeholder={b} placeholderTextColor={MG.ink3} onChangeText={(v) => onChange(items.map((p, j) => (j === i ? [p[0], v.slice(0, 240)] : p)))} style={s.input} />
        </View>
      ))}
      {items.length < 16 ? <Pressable onPress={() => onChange([...items, ["", ""]])} style={s.add}><Feather name="plus" size={14} color={MG.ink2} /><Text style={s.pillText}>Add</Text></Pressable> : null}
    </Field>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  title: { flex: 1, fontFamily: MGFont.display, fontSize: 20, color: MG.ink, paddingVertical: 4, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cc: { alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)" },
  on: { backgroundColor: "#fff", borderColor: "#fff" },
  seg: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 16, marginBottom: 10 },
  segItem: { flex: 1, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: "#fff" },
  segText: { fontFamily: MGFont.bold, fontSize: 13, color: MG.ink2 },
  body: { paddingHorizontal: 16, gap: 14 },
  label: { fontFamily: MGFont.bold, fontSize: 11, letterSpacing: 1.3, color: MG.ink3 },
  note: { fontFamily: MGFont.medium, fontSize: 13, color: MG.ink2, lineHeight: 19 },
  small: { fontFamily: MGFont.medium, fontSize: 12, color: MG.ink3 },
  bodyText: { fontFamily: MGFont.medium, fontSize: 14, color: MG.ink, lineHeight: 20 },
  input: { minHeight: 40, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", color: MG.ink, fontFamily: MGFont.medium, fontSize: 14, textAlignVertical: "top", ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  pill: { height: 32, paddingHorizontal: 12, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  pillOn: { backgroundColor: "#fff", borderColor: "#fff" },
  pillText: { fontFamily: MGFont.bold, fontSize: 12.5, color: MG.ink2 },
  add: { height: 38, borderRadius: 19, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.25)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)" },
  card: { borderRadius: 24, padding: 14, gap: 12, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" },
  cardTitle: { fontFamily: MGFont.bold, fontSize: 15, color: MG.ink },
  white: { height: 44, borderRadius: 22, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  whiteText: { fontFamily: MGFont.bold, fontSize: 14, color: "#1C1640" },
  track: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  fill: { height: "100%", backgroundColor: MG.violet },
  msg: { maxWidth: "85%", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16 },
  msgMe: { alignSelf: "flex-end", backgroundColor: "rgba(139,123,255,0.32)", borderBottomRightRadius: 4 },
  msgAi: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.08)", borderBottomLeftRadius: 4 },
  msgText: { fontFamily: MGFont.medium, fontSize: 13.5, color: MG.ink, lineHeight: 19 },
});
