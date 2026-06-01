/**
 * HomeScreen — V0 Apex design, translated to React Native.
 * Preserves every visual: hex SVG, gradient border, Apex logo,
 * animated waveform bars, cyan→purple→pink CTA, Quick Access grid.
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

const { width: SW } = Dimensions.get("window");

/* ─── Design tokens ──────────────────────────────────────────────── */
const BG       = "#0C081E";
const PURPLE   = "#8B5CF6";
const PURPLE2  = "#7C3AED";
const CYAN     = "#67E8F9";
const PINK     = "#EC4899";
const MUTED    = "rgba(255,255,255,0.5)";
const MUTED2   = "rgba(255,255,255,0.35)";
const CARD_BG  = "rgba(255,255,255,0.06)";
const BORDER   = "rgba(255,255,255,0.1)";

/* ─── Waveform bar ───────────────────────────────────────────────── */
function WaveBar({ index, maxH }: { index: number; maxH: number }) {
  const h = useSharedValue(4);

  useEffect(() => {
    h.value = withDelay(
      index * 25,
      withRepeat(
        withSequence(
          withTiming(maxH, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(4,    { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({ height: h.value }));

  return (
    <Animated.View style={[styles.waveBar, style]}>
      <LinearGradient
        colors={["#A855F7", "#60A5FA"]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const WAVE_HEIGHTS = Array.from({ length: 40 }, (_, i) =>
  Math.sin(i * 0.4) * 14 + Math.random() * 14 + 6,
);

/* ─── Hexagon SVG + Apex logo ────────────────────────────────────── */
function HexCore() {
  return (
    <View style={styles.hexWrapper}>
      {/* Purple glow blobs */}
      <View style={styles.glow1} />
      <View style={styles.glow2} />
      <View style={styles.glow3} />

      {/* Waveform bars — sit behind hex */}
      <View style={styles.waveRow}>
        {WAVE_HEIGHTS.map((h, i) => (
          <WaveBar key={i} index={i} maxH={h} />
        ))}
      </View>

      {/* Hex SVG */}
      <View style={styles.hexContainer}>
        <Svg
          viewBox="0 0 200 230"
          width={176}
          height={192}
          style={styles.hexSvg}
        >
          <Defs>
            <SvgGrad id="hexBorder" x1="50%" y1="0%" x2="50%" y2="100%">
              <Stop offset="0%"   stopColor="#7DD3FC" />
              <Stop offset="15%"  stopColor="#67E8F9" />
              <Stop offset="35%"  stopColor="#A78BFA" />
              <Stop offset="60%"  stopColor="#8B5CF6" />
              <Stop offset="85%"  stopColor="#7C3AED" />
              <Stop offset="100%" stopColor="#6D28D9" />
            </SvgGrad>
          </Defs>
          <Path
            d="M100,8 Q115,8 125,18 L175,52 Q192,62 192,80 L192,150 Q192,168 175,178 L125,212 Q115,222 100,222 Q85,222 75,212 L25,178 Q8,168 8,150 L8,80 Q8,62 25,52 L75,18 Q85,8 100,8 Z"
            fill="rgba(12,8,30,0.92)"
            stroke="url(#hexBorder)"
            strokeWidth="3.5"
          />
        </Svg>

        {/* Apex A logo SVG — centred over hex */}
        <View style={styles.apexLogoWrap}>
          <Svg viewBox="0 0 100 115" width={78} height={90}>
            <Defs>
              <SvgGrad id="apexLogo" x1="50%" y1="0%" x2="50%" y2="100%">
                <Stop offset="0%"   stopColor="#FFFFFF" />
                <Stop offset="30%"  stopColor="#F5F3FF" />
                <Stop offset="60%"  stopColor="#E9D5FF" />
                <Stop offset="100%" stopColor="#D8B4FE" />
              </SvgGrad>
            </Defs>
            {/* Left arm */}
            <Path d="M50,3 L48,3 L6,75 L10,85 L26,60 L42,60 L50,48 L50,3 Z"     fill="url(#apexLogo)" />
            {/* Right arm */}
            <Path d="M50,3 L52,3 L94,75 L90,85 L74,60 L58,60 L50,48 L50,3 Z"     fill="url(#apexLogo)" />
            {/* Inner V cutout */}
            <Path d="M50,28 L36,60 L42,60 L50,48 L58,60 L64,60 Z"                fill="rgba(12,8,30,0.98)" />
            {/* 4-pointed diamond */}
            <Path d="M50,62 L58,78 L50,94 L42,78 Z"                               fill="url(#apexLogo)" />
          </Svg>
        </View>
      </View>
    </View>
  );
}

/* ─── Quick Access card ──────────────────────────────────────────── */
type IconName = React.ComponentProps<typeof Feather>["name"];
function QuickCard({ icon, label, iconColor }: { icon: IconName; label: string; iconColor: string }) {
  return (
    <TouchableOpacity
      style={styles.quickCard}
      activeOpacity={0.75}
      onPress={() => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      <Feather name={icon} size={22} color={iconColor} />
      <Text style={[styles.quickLabel, { color: MUTED }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ─── Home Screen ────────────────────────────────────────────────── */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuBtn}>
            <Feather name="menu" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn}>
            <Feather name="settings" size={20} color="#A78BFA" />
          </TouchableOpacity>
        </View>

        {/* ── Greeting ────────────────────────────────────────────── */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingSub}>Good morning,</Text>
          <Text style={styles.greetingName}>Apex</Text>
          <Text style={styles.greetingTag}>
            How can I help you{"\n"}dominate your day?
          </Text>
        </View>

        {/* ── Hex Core ────────────────────────────────────────────── */}
        <HexCore />

        {/* ── Talk to Apex CTA ────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.ctaWrap}
          activeOpacity={0.85}
          onPress={() => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        >
          <LinearGradient
            colors={["#06B6D4", "#8B5CF6", "#EC4899"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGrad}
          >
            <Text style={styles.ctaText}>Talk to Apex</Text>
            <View style={styles.ctaMicCircle}>
              <Feather name="mic" size={18} color="white" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Quick Access ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickGrid}>
            <QuickCard icon="message-square" label="AI Chat"          iconColor="#A78BFA" />
            <QuickCard icon="users"          label="Direct Messages"  iconColor="#A78BFA" />
            <QuickCard icon="hexagon"        label="Hive Mode"        iconColor="#67E8F9" />
            <QuickCard icon="image"          label="Screenshot AI"   iconColor="#A78BFA" />
            <QuickCard icon="phone"          label="Voice Chat"       iconColor="#A78BFA" />
            <QuickCard icon="zap"            label="Battle Mode"      iconColor="#EC4899" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  menuBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD_BG,
    alignItems: "center", justifyContent: "center",
  },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: "#7C3AED",
    alignItems: "center", justifyContent: "center",
  },

  /* Greeting */
  greetingBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  greetingSub:  { fontSize: 20, color: MUTED, fontWeight: "400" },
  greetingName: { fontSize: 36, fontWeight: "700", color: "#A78BFA", marginTop: 2 },
  greetingTag:  { fontSize: 16, color: MUTED, marginTop: 10, lineHeight: 24 },

  /* Hex area */
  hexWrapper: {
    alignItems: "center",
    justifyContent: "center",
    height: 280,
    marginVertical: 8,
    overflow: "visible",
  },
  glow1: {
    position: "absolute",
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: "rgba(139,92,246,0.35)",
    // RN doesn't support CSS blur, use opacity layering
    opacity: 0.6,
  },
  glow2: {
    position: "absolute",
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(109,28,209,0.25)",
    opacity: 0.7,
  },
  glow3: {
    position: "absolute",
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(6,182,212,0.12)",
    opacity: 0.8,
  },

  /* Waveform */
  waveRow: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    width: SW - 40,
    justifyContent: "center",
  },
  waveBar: {
    width: 3,
    borderRadius: 99,
    overflow: "hidden",
    minHeight: 4,
  },

  /* Hex container */
  hexContainer: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  hexSvg: {
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.8,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  apexLogoWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  /* CTA button */
  ctaWrap: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  ctaGrad: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  ctaText: { fontSize: 16, fontWeight: "600", color: "white" },
  ctaMicCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },

  /* Quick Access */
  section:      { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 13, color: MUTED2, marginBottom: 12, fontWeight: "500" },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickCard: {
    width: (SW - 60) / 3,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  quickLabel: { fontSize: 11, fontWeight: "500", textAlign: "center" },
});
