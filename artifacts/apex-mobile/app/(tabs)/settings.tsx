/**
 * Settings: system controls, wake phrase, Apex tone and account, opened from the ☰ menu.
 * Control Center layout: a tile of round toggles next to two tall sliders.
 */
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop } from "@/components/glass/Glass";
import { MG, MGFont } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { setPref, usePrefs, type ApexPrefs } from "@/lib/prefs";
import { WEB_APP_URL } from "@/services/api";

const TONES: { id: ApexPrefs["personality"]; label: string; emoji: string }[] = [
  { id: "friend",    label: "Friend",    emoji: "👋" },
  { id: "assistant", label: "Assistant", emoji: "🤖" },
  { id: "formal",    label: "Formal",    emoji: "👔" },
  { id: "creative",  label: "Creative",  emoji: "🎨" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const p = usePrefs();
  const { user, logout } = useAuth();
  const onOff = (v: boolean) => (v ? "on" : "off");

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}>
        <View style={s.header}>
          <Pressable accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(tabs)"))} style={[s.cc, { width: 40, height: 40 }]}>
            <Feather name="chevron-left" size={20} color="#fff" />
          </Pressable>
          <Text style={s.h1}>Settings</Text>
        </View>

        <Text style={s.label}>SYSTEM CONTROLS</Text>
        <View style={s.controls}>
          <LinearGradient colors={["rgba(139,123,255,0.5)", "rgba(139,123,255,0.18)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
            <Toggle label="Dark mode" on={p.darkMode} onPress={() => setPref("darkMode", !p.darkMode)} icon={<Feather name="moon" size={21} color={p.darkMode ? "#7A6BFF" : "#fff"} />} />
            <Toggle label="Voice mode" on={p.voiceMode} onPress={() => setPref("voiceMode", !p.voiceMode)} icon={<Feather name="mic" size={21} color={p.voiceMode ? "#7A6BFF" : "#fff"} />} />
            <Toggle label="Memory" on={p.memoryEnabled} onPress={() => setPref("memoryEnabled", !p.memoryEnabled)} icon={<MaterialCommunityIcons name="brain" size={22} color={p.memoryEnabled ? "#7A6BFF" : "#fff"} />} />
            <Toggle label="Hands-free" on={p.handsFree} onPress={() => setPref("handsFree", !p.handsFree)} icon={<MaterialCommunityIcons name="account-voice" size={22} color={p.handsFree ? "#7A6BFF" : "#fff"} />} />
          </LinearGradient>
          <VSlider label="Apex volume" value={p.volume} min={0} max={1} onChange={(v) => setPref("volume", v)} format={(v) => `${Math.round(v * 100)}%`} icon="volume-2" />
          <VSlider label="Apex speaking speed" value={p.speechRate} min={0.5} max={2} onChange={(v) => setPref("speechRate", v)} format={(v) => `${v.toFixed(1)}×`} icon="fast-forward" />
        </View>
        <Text style={s.summary} accessibilityLiveRegion="polite">
          Dark mode {onOff(p.darkMode)} · Voice mode {onOff(p.voiceMode)} · Memory {onOff(p.memoryEnabled)} · Hands-free {onOff(p.handsFree)}
        </Text>

        <Text style={s.label}>WAKE PHRASE</Text>
        <LinearGradient colors={["rgba(139,123,255,0.6)", "rgba(0,194,255,0.8)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.wake}>
          <Text style={s.wakeHint}>Say this to start talking to Apex</Text>
          <TextInput
            value={p.wakePhrase}
            onChangeText={(t) => setPref("wakePhrase", t.slice(0, 40))}
            onBlur={() => { if (!p.wakePhrase.trim()) setPref("wakePhrase", "Hey Apex"); }}
            placeholder="Hey Apex"
            placeholderTextColor="rgba(255,255,255,0.6)"
            accessibilityLabel="Wake phrase"
            style={s.wakeInput}
          />
        </LinearGradient>

        <Text style={s.label}>APEX TONE</Text>
        <View style={s.tones} accessibilityRole="radiogroup">
          {TONES.map((t) => {
            const on = p.personality === t.id;
            return (
              <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setPref("personality", t.id)} style={({ pressed }) => [s.tone, on && s.toneOn, pressed && { transform: [{ scale: 0.96 }] }]}>
                <Text style={[s.toneText, on && { color: "#1C1640" }]}>{t.emoji}  {t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>ACCOUNT</Text>
        <View style={s.card}>
          <Row icon="user" title={user?.username ?? "Profile"} onPress={() => router.navigate("/(tabs)/profile")} first />
          <Row icon="activity" title="Usage & plan" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_APP_URL}/usage`)} />
          <Row icon="shield" title="Privacy & notifications" onPress={() => router.navigate("/(tabs)/profile")} />
          <Row icon="log-out" title="Sign out" danger onPress={() => void logout()} />
        </View>
      </ScrollView>
    </View>
  );
}

function Toggle({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon: React.ReactNode }) {
  return (
    <View style={s.toggleCell}>
      <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={onPress} style={({ pressed }) => [s.cc, { width: 54, height: 54 }, on && s.on, pressed && { transform: [{ scale: 0.92 }] }]}>
        {icon}
      </Pressable>
    </View>
  );
}

/** Tall slider: the white fill rises from the bottom. Drag or tap anywhere on it. */
function VSlider({ label, value, min, max, onChange, format, icon }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; format: (v: number) => string; icon: React.ComponentProps<typeof Feather>["name"] }) {
  const [h, setH] = useState(1);
  const hRef = useRef(1);
  const pct = (value - min) / (max - min);
  const step = (max - min) / 20;
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)) * 100) / 100;
  const fromTouch = (e: GestureResponderEvent) => onChange(clamp(min + (1 - e.nativeEvent.locationY / hRef.current) * (max - min)));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === "increment" ? step : -step)))}
      onLayout={(e) => { hRef.current = e.nativeEvent.layout.height; setH(e.nativeEvent.layout.height); }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={fromTouch}
      onResponderMove={fromTouch}
      style={[s.slider, Platform.OS === "web" && ({ cursor: "ns-resize", touchAction: "none" } as object)]}
    >
      <View pointerEvents="none" style={[s.sliderFill, { height: pct * h }]} />
      <View pointerEvents="none" style={s.sliderIcon}>
        <Feather name={icon} size={21} color={pct > 0.12 ? "#7A6BFF" : "#fff"} />
      </View>
    </View>
  );
}

function Row({ icon, title, onPress, danger, first }: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; onPress: () => void; danger?: boolean; first?: boolean }) {
  const color = danger ? "#FF7A9C" : MG.ink;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.rowItem, !first && s.rowBorder, pressed && { backgroundColor: "rgba(255,255,255,0.05)" }]}>
      <View style={[s.cc, { width: 34, height: 34 }]}><Feather name={icon} size={16} color={danger ? "#FF7A9C" : "#fff"} /></View>
      <Text style={[s.rowText, { color }]}>{title}</Text>
      {!danger ? <Feather name="chevron-right" size={16} color={MG.ink3} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 10, maxWidth: 560, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  h1: { fontFamily: MGFont.display, fontSize: 28, color: MG.ink },
  label: { fontFamily: MGFont.bold, fontSize: 11, letterSpacing: 1.3, color: MG.ink3, marginTop: 14, marginLeft: 2 },
  cc: { alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)" },
  on: { backgroundColor: "#fff", borderColor: "#fff" },
  controls: { flexDirection: "row", gap: 10, height: 170 },
  tile: { flex: 2.4, borderRadius: 30, padding: 10, flexDirection: "row", flexWrap: "wrap", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)" },
  toggleCell: { width: "50%", height: "50%", alignItems: "center", justifyContent: "center" },
  slider: { flex: 1, borderRadius: 28, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)" },
  sliderFill: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#F4F2FF" },
  sliderIcon: { position: "absolute", left: 0, right: 0, bottom: 16, alignItems: "center" },
  summary: { fontFamily: MGFont.medium, fontSize: 12, color: MG.ink3, textAlign: "center" },
  wake: { borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)" },
  wakeHint: { fontFamily: MGFont.medium, fontSize: 12, color: "rgba(255,255,255,0.8)" },
  wakeInput: { fontFamily: MGFont.bold, fontSize: 18, color: "#fff", paddingVertical: 2, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  tones: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tone: { width: "48%", flexGrow: 1, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" },
  toneOn: { backgroundColor: "#fff", borderColor: "#fff" },
  toneText: { fontFamily: MGFont.bold, fontSize: 14, color: MG.ink2 },
  card: { borderRadius: 26, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)" },
  rowItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  rowText: { flex: 1, fontFamily: MGFont.semi, fontSize: 14.5 },
});
