/**
 * Midnight Glass building blocks: the moving-light backdrop and frosted panels.
 */
import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { MG } from "@/constants/colors";

/** Full-screen background: navy base with soft violet, cyan and pink light. */
export function Backdrop() {
  const uid = React.useId().replace(/:/g, "");
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: MG.bg }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`mgViolet${uid}`} cx="4%" cy="24%" r="42%">
            <Stop offset="0" stopColor="#6C5CE7" stopOpacity="0.95" />
            <Stop offset="0.55" stopColor="#6C5CE7" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#6C5CE7" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`mgCyan${uid}`} cx="98%" cy="47%" r="40%">
            <Stop offset="0" stopColor="#00C2FF" stopOpacity="0.8" />
            <Stop offset="0.55" stopColor="#00C2FF" stopOpacity="0.32" />
            <Stop offset="1" stopColor="#00C2FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`mgPink${uid}`} cx="22%" cy="88%" r="36%">
            <Stop offset="0" stopColor="#FF4FA3" stopOpacity="0.6" />
            <Stop offset="0.55" stopColor="#FF4FA3" stopOpacity="0.25" />
            <Stop offset="1" stopColor="#FF4FA3" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#mgViolet${uid})`} />
        <Rect width="100%" height="100%" fill={`url(#mgCyan${uid})`} />
        <Rect width="100%" height="100%" fill={`url(#mgPink${uid})`} />
      </Svg>
    </View>
  );
}

/** A frosted glass panel. Children sit on top of the blur. */
export function Glass({
  children,
  style,
  radius = 24,
  intensity = 30,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
}) {
  return (
    <View style={[styles.shell, { borderRadius: radius }, Platform.OS === "web" && webBlur(intensity), style]}>
      {/* On web the browser blurs the panel itself (BlurView would cover the children there) */}
      {Platform.OS !== "web" ? (
        <BlurView
          intensity={intensity}
          tint="dark"
          // Android needs the experimental method for a real blur
          experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.05)"]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <View pointerEvents="none" style={[styles.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
      {children}
    </View>
  );
}

function webBlur(intensity: number): ViewStyle {
  const px = Math.round(intensity / 2);
  return { backdropFilter: `blur(${px}px) saturate(180%)`, WebkitBackdropFilter: `blur(${px}px) saturate(180%)` } as ViewStyle;
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
