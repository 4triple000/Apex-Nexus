/**
 * The ☰ menu: Control Center style bubbles for screens that aren't in the tab bar,
 * and the 7-day streak that lights up by itself (nothing to tap).
 */
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef } from "react";
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { MG, MGFont } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { clearEarned, useStreak } from "@/lib/streak";
import { WEB_APP_URL } from "@/services/api";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

// Voice and Settings are screens in the app; the rest open the website page
const BUBBLES: { label: string; icon: FeatherName; route?: string; web?: string }[] = [
  { label: "Marketplace", icon: "shopping-bag", web: "/marketplace" },
  { label: "Workflows",   icon: "git-branch",   web: "/workflows" },
  { label: "Social",      icon: "users",        web: "/feed" },
  { label: "Explore",     icon: "compass",      web: "/explore" },
  { label: "Voice",       icon: "mic",          route: "/(tabs)/orb" },
  { label: "Avatar",      icon: "smile",        web: "/apex-avatar" },
  { label: "Insights",    icon: "bar-chart-2",  web: "/insights" },
  { label: "Settings",    icon: "settings",     route: "/(tabs)/settings" },
];

export function MenuSheet({ visible, onClose, current }: { visible: boolean; onClose: () => void; current?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const isOwner = !!(user as { isOwner?: boolean } | null)?.isOwner;
  const sheetW = Math.min(320, width * 0.82);
  const slide = useRef(new Animated.Value(-sheetW)).current;

  useEffect(() => {
    if (visible) Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: Platform.OS !== "web" }).start();
    else slide.setValue(-sheetW);
  }, [visible, sheetW, slide]);

  const open = (b: (typeof BUBBLES)[number]) => {
    onClose();
    if (b.route) router.navigate(b.route as never);
    else if (b.web) void WebBrowser.openBrowserAsync(`${WEB_APP_URL}${b.web}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.dim} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View style={[s.sheet, { width: sheetW, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18, transform: [{ translateX: slide }] }]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, gap: 18 }} showsVerticalScrollIndicator={false}>
          <View style={s.head}>
            <Text style={s.title}>Apex</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {isOwner ? (
                <Pressable accessibilityLabel="Dev Cockpit" onPress={() => { onClose(); void WebBrowser.openBrowserAsync(`${WEB_APP_URL}/dev-cockpit`); }} style={[s.cc, s.small, { borderColor: "rgba(255,207,138,0.7)" }]}>
                  <Feather name="tool" size={16} color="#FFCF8A" />
                </Pressable>
              ) : null}
              <Pressable accessibilityLabel="Close menu" onPress={onClose} style={[s.cc, s.small]}>
                <Feather name="x" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={s.grid}>
            {BUBBLES.map((b) => {
              const here = current === b.label;
              return (
                <Pressable key={b.label} accessibilityRole="button" accessibilityLabel={b.label} onPress={() => open(b)} style={s.bubble}>
                  {({ pressed }) => (
                    <>
                      <View style={[s.cc, s.big, here && s.on, pressed && { transform: [{ scale: 0.92 }] }]}>
                        <Feather name={b.icon} size={26} color={here ? "#7A6BFF" : "#fff"} />
                      </View>
                      <Text style={s.bubbleLabel}>{b.label}</Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>

          <StreakCard />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function StreakCard() {
  const st = useStreak();
  const qc = useQueryClient();
  const lit = st?.cycleDay ?? 0;
  const prev = useRef<number | null>(null);
  const pop = useRef(new Animated.Value(1)).current;

  // Today's circle pops when it lights up
  useEffect(() => {
    const before = prev.current;
    prev.current = lit;
    if (before === null || lit <= before) return;
    pop.setValue(0.7);
    Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: Platform.OS !== "web" }).start();
  }, [lit, pop]);

  useEffect(() => {
    if (st?.earned === "bonus") void qc.invalidateQueries({ queryKey: ["daily-usage"] });
  }, [st?.earned, qc]);

  if (!st) {
    return <View style={[s.card, { marginTop: "auto" }]}><Text style={s.muted}>Your 7-day streak shows up here.</Text></View>;
  }

  const left = 7 - lit;
  return (
    <View style={[s.card, { marginTop: "auto", gap: 10 }]} accessibilityLabel={`${st.streak}-day streak, ${lit} of 7 days this week`}>
      <View style={s.row}>
        <Text style={s.cardTitle}>{st.streak}-day streak</Text>
        <Text style={s.small11}>{left === 0 ? "Week complete" : st.checkedInToday ? `${left} to go` : "Use Apex today to keep it"}</Text>
      </View>
      <View style={s.days}>
        {Array.from({ length: 7 }, (_, i) => {
          const on = i < lit;
          const Circle = (
            <View style={[s.cc, s.day, on && s.on]}>
              {on ? <MaterialCommunityIcons name="fire" size={15} color="#FF8A4C" /> : <Text style={s.dayNum}>{i + 1}</Text>}
            </View>
          );
          return on && i === lit - 1
            ? <Animated.View key={i} style={{ flex: 1, transform: [{ scale: pop }] }}>{Circle}</Animated.View>
            : <View key={i} style={{ flex: 1 }}>{Circle}</View>;
        })}
      </View>
      <Text style={s.label}>REWARDS</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Reward got={st.rewards.bonus.earned} title={`Day ${st.rewards.bonus.day}`} text={`+${st.rewards.bonus.messages} messages today`} />
        <Reward got={st.rewards.avatar.earned} title={`Day ${st.rewards.avatar.day}`} text="Midnight avatar outfit" />
      </View>
      {st.earned ? (
        <Pressable onPress={clearEarned} style={s.toast} accessibilityRole="text">
          <Text style={s.toastText}>
            {st.earned === "bonus" ? `Day ${st.rewards.bonus.day} reward: +${st.rewards.bonus.messages} messages added for today` : "Day 7 reward: the Midnight outfit is unlocked in Avatar"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Reward({ got, title, text }: { got: boolean; title: string; text: string }) {
  return (
    <View style={[s.reward, got && { backgroundColor: "#fff", borderColor: "#fff" }]}>
      <Text style={[s.rewardTitle, got && { color: "#2A1300" }]}>{title}{got ? " ✓" : ""}</Text>
      <Text style={[s.rewardText, got && { color: "#5B4A3A" }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,7,20,0.45)" },
  sheet: {
    position: "absolute", top: 0, bottom: 0, left: 0, paddingHorizontal: 16,
    backgroundColor: "rgba(30,26,64,0.96)", borderRightWidth: 1.5, borderRightColor: "rgba(255,255,255,0.16)",
    ...(Platform.OS === "web" ? ({ backdropFilter: "blur(28px) saturate(170%)", backgroundColor: "rgba(34,30,72,0.8)" } as object) : {}),
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: MGFont.display, fontSize: 22, color: MG.ink },
  cc: { alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)" },
  on: { backgroundColor: "#fff", borderColor: "#fff" },
  small: { width: 38, height: 38 },
  big: { width: 66, height: 66 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
  bubble: { width: "50%", alignItems: "center", gap: 7 },
  bubbleLabel: { fontFamily: MGFont.semi, fontSize: 12, color: MG.ink2 },
  card: { borderRadius: 26, padding: 14, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)" },
  row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontFamily: MGFont.display, fontSize: 15, color: MG.ink },
  small11: { fontFamily: MGFont.medium, fontSize: 11.5, color: MG.ink3, flexShrink: 1, textAlign: "right" },
  muted: { fontFamily: MGFont.medium, fontSize: 13, color: MG.ink2 },
  days: { flexDirection: "row", gap: 6 },
  day: { width: "100%", aspectRatio: 1 },
  dayNum: { fontFamily: MGFont.bold, fontSize: 11, color: MG.ink3 },
  label: { fontFamily: MGFont.bold, fontSize: 10.5, letterSpacing: 1.2, color: MG.ink3 },
  reward: { flex: 1, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" },
  rewardTitle: { fontFamily: MGFont.bold, fontSize: 11.5, color: MG.ink2 },
  rewardText: { fontFamily: MGFont.medium, fontSize: 11, color: MG.ink3, marginTop: 1 },
  toast: { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 },
  toastText: { fontFamily: MGFont.semi, fontSize: 12.5, color: "#2A1300" },
});
