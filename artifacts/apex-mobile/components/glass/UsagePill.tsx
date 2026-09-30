/** "18 credits left" — today's AI credits; tap for the credits sheet. */
import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { MG, MGFont } from "@/constants/colors";
import { useCredits, openCreditsSheet } from "@/components/CreditsSheet";

export function UsagePill() {
  const { data } = useCredits();
  if (!data) return null;
  const pct = data.unlimited ? 0 : Math.min(1, data.used / Math.max(1, data.limit));
  const warn = !data.unlimited && pct >= 0.8;
  const left = data.unlimited ? 1 : 1 - pct;
  const r = 7, c = 2 * Math.PI * r;
  return (
    <Pressable
      onPress={() => openCreditsSheet("info")}
      accessibilityRole="button"
      accessibilityLabel={data.unlimited ? "Unlimited AI credits" : `${data.remaining} AI credits left today. Tap for details.`}
      style={({ pressed }) => [s.pill, pressed && { opacity: 0.8 }]}
    >
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Circle cx={9} cy={9} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2.5} />
        <Circle cx={9} cy={9} r={r} fill="none" stroke={warn ? "#FFD479" : MG.violet} strokeWidth={2.5} strokeDasharray={`${c * left} ${c}`} strokeLinecap="round" transform="rotate(-90 9 9)" />
      </Svg>
      <Text style={[s.text, warn && { color: "#FFD479" }]}>{data.unlimited ? "Unlimited" : `${data.remaining} credit${data.remaining === 1 ? "" : "s"} left`}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, height: 26, paddingLeft: 5, paddingRight: 10, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignSelf: "flex-end" },
  text: { color: MG.ink2, fontSize: 11.5, fontFamily: MGFont.bold },
});
