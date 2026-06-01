/**
 * Apex Orb Screen — translated pixel-perfect from MobileOrb mockup.
 * Orb SVG + waveform + control buttons + personality/memory bottom sheet.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient as SvgGrad,
  Stop,
  Circle,
  Ellipse,
  Line,
  Rect,
  G,
} from "react-native-svg";

const WAVE_ORB = [3, 5, 8, 13, 19, 26, 34, 38, 34, 26, 19, 13, 8, 5, 3];

function OrbSvg() {
  return (
    <Svg width={260} height={260} viewBox="0 0 260 260">
      <Defs>
        <RadialGradient id="orbFill" cx="40%" cy="35%" r="65%" fx="40%" fy="35%">
          <Stop offset="0%"   stopColor="rgba(130,55,230,0.55)" />
          <Stop offset="45%"  stopColor="rgba(60,20,140,0.5)"   />
          <Stop offset="100%" stopColor="rgba(7,5,20,0.97)"     />
        </RadialGradient>
        <SvgGrad id="orbRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%"   stopColor="#A855F7" />
          <Stop offset="35%"  stopColor="#7C3AED" />
          <Stop offset="65%"  stopColor="#4F46E5" />
          <Stop offset="100%" stopColor="#3B82F6" />
        </SvgGrad>
        <RadialGradient id="orbInner" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor="rgba(150,90,255,0.35)" />
          <Stop offset="100%" stopColor="transparent"           />
        </RadialGradient>
      </Defs>

      {/* Outermost faint dashed ring */}
      <Circle cx={130} cy={130} r={122} fill="none" stroke="rgba(100,120,255,0.25)" strokeWidth={1} strokeDasharray="3 9" />

      {/* Bloom rings — simulated with opacity stacking since RN SVG filters are limited */}
      <Circle cx={130} cy={130} r={112} fill="none" stroke="#7C3AED" strokeWidth={6} opacity={0.18} />
      <Circle cx={130} cy={130} r={112} fill="none" stroke="#7C3AED" strokeWidth={4} opacity={0.25} />
      <Circle cx={130} cy={130} r={112} fill="none" stroke="#7C3AED" strokeWidth={2} opacity={0.45} />

      {/* Main glowing ring */}
      <Circle cx={130} cy={130} r={108} fill="none" stroke="url(#orbRing)" strokeWidth={3.5} opacity={0.95} />
      <Circle cx={130} cy={130} r={108} fill="none" stroke="url(#orbRing)" strokeWidth={7} opacity={0.18} />

      {/* Secondary inner ring */}
      <Circle cx={130} cy={130} r={100} fill="none" stroke="rgba(180,120,255,0.3)" strokeWidth={1.5} />

      {/* Orb fill */}
      <Circle cx={130} cy={130} r={96} fill="url(#orbFill)" />

      {/* Inner glow overlay */}
      <Circle cx={130} cy={130} r={96} fill="url(#orbInner)" />

      {/* Inner accent ring */}
      <Circle cx={130} cy={130} r={74} fill="none" stroke="rgba(160,100,255,0.15)" strokeWidth={1} />

      {/* Blue dot top-right */}
      <Circle cx={198} cy={66} r={5} fill="#60A5FA" opacity={0.9} />
      <Circle cx={198} cy={66} r={9} fill="#60A5FA" opacity={0.15} />

      {/* Apex A logo — glow layer */}
      <G opacity={0.25}>
        <Line x1={130} y1={96} x2={104} y2={164} stroke="white" strokeWidth={9} strokeLinecap="round" />
        <Line x1={130} y1={96} x2={156} y2={164} stroke="white" strokeWidth={9} strokeLinecap="round" />
        <Line x1={113} y1={140} x2={147} y2={140} stroke="white" strokeWidth={8} strokeLinecap="round" />
      </G>
      {/* Apex A logo — solid */}
      <G>
        <Line x1={130} y1={96} x2={104} y2={164} stroke="white" strokeWidth={5} strokeLinecap="round" />
        <Line x1={130} y1={96} x2={156} y2={164} stroke="white" strokeWidth={5} strokeLinecap="round" />
        <Line x1={113} y1={140} x2={147} y2={140} stroke="white" strokeWidth={4.5} strokeLinecap="round" />
      </G>

      {/* Highlight glint */}
      <Ellipse cx={104} cy={105} rx={16} ry={9} fill="rgba(255,255,255,0.055)" rotation={-30} originX={104} originY={105} />
    </Svg>
  );
}

function WaveformSvg() {
  const barWidth = 7;
  const gap = 17;
  const totalWidth = WAVE_ORB.length * gap + 5;

  return (
    <Svg width={totalWidth} height={40} viewBox={`0 0 ${totalWidth} 40`}>
      <Defs>
        <SvgGrad id="orbWave" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%"   stopColor="#6D28D9" stopOpacity={0.3}  />
          <Stop offset="25%"  stopColor="#9333EA" stopOpacity={0.9}  />
          <Stop offset="50%"  stopColor="#A855F7" stopOpacity={1}    />
          <Stop offset="75%"  stopColor="#9333EA" stopOpacity={0.9}  />
          <Stop offset="100%" stopColor="#6D28D9" stopOpacity={0.3}  />
        </SvgGrad>
      </Defs>
      {WAVE_ORB.map((h, i) => (
        <G key={i}>
          <Rect x={i * gap + 5} y={20 - h} width={barWidth} height={h} rx={3.5} fill="url(#orbWave)" opacity={0.9} />
          <Rect x={i * gap + 5} y={20}      width={barWidth} height={h} rx={3.5} fill="url(#orbWave)" opacity={0.55} />
        </G>
      ))}
    </Svg>
  );
}

function ControlButton({ children }: { children: React.ReactNode }) {
  return (
    <TouchableOpacity style={styles.controlBtn} activeOpacity={0.7}>
      {children}
    </TouchableOpacity>
  );
}

export default function OrbScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root]}>

      {/* Deep ambient glow behind orb */}
      <View style={styles.glowOuter} />
      <View style={styles.glowInner} />

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: Platform.OS === "web" ? 50 : insets.top + 12 }]}>
        <TouchableOpacity style={styles.topBtn}>
          <Feather name="x" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Apex Orb</Text>
        <TouchableOpacity style={styles.topBtn}>
          <Feather name="more-vertical" size={22} color="rgba(255,255,255,0.8)" />
          <View style={styles.blueDot} />
        </TouchableOpacity>
      </View>

      {/* Orb SVG */}
      <View style={styles.orbContainer}>
        <OrbSvg />
      </View>

      {/* Status text */}
      <View style={styles.statusBlock}>
        <Text style={styles.statusTitle}>Listening...</Text>
        <Text style={styles.statusSub}>Tap to stop</Text>
      </View>

      {/* Mirrored waveform */}
      <View style={styles.waveContainer}>
        <WaveformSvg />
      </View>

      {/* Control buttons */}
      <View style={styles.controlRow}>
        <ControlButton>
          <Feather name="mic" size={22} color="white" />
        </ControlButton>
        <ControlButton>
          <Feather name="type" size={22} color="white" />
        </ControlButton>
        <ControlButton>
          <Feather name="settings" size={22} color="white" />
        </ControlButton>
      </View>

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>

        {/* Apex Personality */}
        <View style={styles.personalitySection}>
          <Text style={styles.sheetLabel}>Apex Personality</Text>
          <Text style={styles.sheetValue}>Relentless. Intelligent. Loyal.</Text>
          <TouchableOpacity style={styles.customizeBtn} activeOpacity={0.7}>
            <Text style={styles.customizeBtnText}>Customize</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Memory Status */}
        <View style={styles.memoryRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetLabel}>Memory Status</Text>
            <Text style={styles.sheetValue}>Always learning. Always evolving.</Text>
          </View>
          <Feather name="cpu" size={28} color="rgba(255,255,255,0.18)" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07070E",
    overflow: "hidden",
  },

  glowOuter: {
    position: "absolute",
    top: 120,
    left: "50%",
    marginLeft: -190,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "rgba(50,30,160,0.45)",
    opacity: 0.65,
  },
  glowInner: {
    position: "absolute",
    top: 160,
    left: "50%",
    marginLeft: -110,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(130,50,255,0.35)",
    opacity: 0.55,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingBottom: 0,
    zIndex: 10,
  },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "white",
    letterSpacing: 0.2,
  },
  blueDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#60A5FA",
    borderWidth: 1.5,
    borderColor: "#07070E",
  },

  orbContainer: {
    alignItems: "center",
    marginTop: 22,
    zIndex: 10,
  },

  statusBlock: {
    alignItems: "center",
    marginTop: 12,
    zIndex: 10,
  },
  statusTitle: {
    fontSize: 26,
    fontWeight: "500",
    color: "rgba(255,255,255,0.95)",
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  statusSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
  },

  waveContainer: {
    alignItems: "center",
    marginTop: 16,
    zIndex: 10,
  },

  controlRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    marginTop: 22,
    zIndex: 10,
  },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,8,24,0.98)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 24,
    paddingTop: 20,
    zIndex: 20,
  },

  personalitySection: {
    marginBottom: 6,
  },
  sheetLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.38)",
    textTransform: "uppercase",
    letterSpacing: 1.3,
    marginBottom: 5,
    fontWeight: "600",
  },
  sheetValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    marginBottom: 14,
  },
  customizeBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  customizeBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.2,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 18,
  },

  memoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
