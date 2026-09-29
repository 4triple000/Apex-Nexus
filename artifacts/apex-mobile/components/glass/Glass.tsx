/**
 * Midnight Glass building blocks: the moving-light backdrop and frosted panels.
 */
import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { MG } from "@/constants/colors";

/** Full-screen background: navy base with soft violet, cyan and pink light. */
export function Backdrop() {
  const uid = React.useId().replace(/:/g, "");
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: MG.bg }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`mgViolet${uid}`} cx="10%" cy="18%" r="55%">
            <Stop offset="0" stopColor="#6C5CE7" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#6C5CE7" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`mgCyan${uid}`} cx="95%" cy="55%" r="50%">
            <Stop offset="0" stopColor="#00C2FF" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#00C2FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`mgPink${uid}`} cx="20%" cy="92%" r="45%">
            <Stop offset="0" stopColor="#FF4FA3" stopOpacity="0.24" />
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
  intensity = 40,
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
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, { borderRadius: radius }]} />
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
    borderColor: MG.glassBorder,
  },
  tint: { backgroundColor: MG.glassFill },
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
});
