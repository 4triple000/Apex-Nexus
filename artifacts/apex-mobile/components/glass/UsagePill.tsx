/** "12 / 20 today" — AI messages used today against the daily limit. */
import React from "react";
import { Text, View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";

import { MG, MGFont } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { usageApi } from "@/services/api";

export function UsagePill() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["daily-usage", user?.sessionId],
    enabled: !!user?.sessionId,
    queryFn: () => usageApi.today(user!.sessionId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  if (!data) return null;
  const pct = Math.min(1, data.requestsUsed / Math.max(1, data.requestsLimit));
  const warn = pct >= 0.8;
  const r = 7, c = 2 * Math.PI * r;
  return (
    <View style={s.pill} accessibilityLabel={`${data.requestsUsed} of ${data.requestsLimit} AI messages used today`}>
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Circle cx={9} cy={9} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2.5} />
        <Circle cx={9} cy={9} r={r} fill="none" stroke={warn ? "#FFD479" : MG.violet} strokeWidth={2.5} strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" transform="rotate(-90 9 9)" />
      </Svg>
      <Text style={[s.text, warn && { color: "#FFD479" }]}>{data.requestsUsed} / {data.requestsLimit} today</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, height: 26, paddingLeft: 5, paddingRight: 10, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignSelf: "flex-end" },
  text: { color: MG.ink2, fontSize: 11.5, fontFamily: MGFont.bold },
});
