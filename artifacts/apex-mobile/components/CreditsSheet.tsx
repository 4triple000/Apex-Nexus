/**
 * Credits sheet — credits left today, what each model costs, and the ways to get more.
 * Mounted once in the tabs layout; open it from anywhere with openCreditsSheet().
 */
import React, { useEffect, useState } from "react";
import { Alert, DeviceEventEmitter, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";

import { MG, MGFont } from "@/constants/colors";
import { creditsApi, storeApi, CREDIT_PACKS, WEB_APP_URL } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

const EVENT = "apex:credits-sheet";

const MODEL_NAMES: Record<string, string> = {
  llama: "Llama", deepseek: "DeepSeek", gemini: "Gemini", mistral: "Mistral",
  openai: "ChatGPT", grok: "Grok", perplexity: "Perplexity", claude: "Claude", elevenlabs: "Voice line",
};

export function openCreditsSheet(reason: "info" | "out" = "info", message?: string) {
  DeviceEventEmitter.emit(EVENT, { reason, message });
}

export function resetsIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `in ${h}h ${m}m` : `in ${m}m`;
}

/** Today's credits for the signed-in person. */
export function useCredits() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["credits"], enabled: !!user?.sessionId, queryFn: creditsApi.today, staleTime: 20_000, refetchInterval: 60_000 });
}

export function CreditsSheetHost() {
  const router = useRouter();
  const [open, setOpen] = useState<{ reason: "info" | "out"; message?: string } | null>(null);
  const { data, refetch } = useCredits();

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(EVENT, (detail: { reason: "info" | "out"; message?: string }) => {
      setOpen(detail);
      void refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  const close = () => setOpen(null);

  // Stripe checkout: same tab on the website version, the browser on the phone
  const checkout = async (start: (returnTo: string) => Promise<string>) => {
    const returnTo = Platform.OS === "web" && typeof window !== "undefined" ? `${window.location.origin}/` : `${WEB_APP_URL}/pricing`;
    try {
      const url = await start(returnTo);
      if (Platform.OS === "web") window.location.href = url;
      else { close(); await WebBrowser.openBrowserAsync(url); void refetch(); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't start checkout.";
      if (Platform.OS === "web") window.alert(msg); else Alert.alert("Checkout", msg);
    }
  };
  const out = open?.reason === "out";
  const isPaid = data?.tier === "pro" || data?.tier === "enterprise";
  const pct = data && !data.unlimited ? Math.min(1, data.used / Math.max(1, data.limit)) : 0;
  const costs = Object.entries(data?.costs ?? {}).filter(([id]) => MODEL_NAMES[id]).sort((a, b) => a[1] - b[1]);

  return (
    <Modal visible={!!open} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.scrim} onPress={close} accessibilityLabel="Close credits">
        <Pressable style={s.sheet} onPress={() => undefined}>
          <ScrollView contentContainerStyle={{ gap: 16 }}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{out ? "You're out of credits for today" : "Your AI credits"}</Text>
                <Text style={s.sub}>
                  {open?.message ?? (data?.unlimited ? "You have unlimited credits." : `Credits reset ${data ? resetsIn(data.resetsAt) : "at midnight"}.`)}
                </Text>
              </View>
              <Pressable onPress={close} accessibilityLabel="Close" style={s.close}><Feather name="x" size={16} color={MG.ink} /></Pressable>
            </View>

            {data && !data.unlimited && (
              <View style={{ gap: 8 }}>
                <Text style={s.big}>{data.remaining} <Text style={s.of}>left ({data.dailyRemaining} of {data.limit} daily{data.purchased ? ` + ${data.purchased} bought` : ""})</Text></Text>
                <View style={s.track}><View style={[s.fill, { width: `${(1 - pct) * 100}%`, backgroundColor: pct >= 0.8 ? "#FFD479" : MG.violet }]} /></View>
              </View>
            )}

            <View style={{ gap: 8 }}>
              {!isPaid && !data?.isOwner && (
                <Option icon="award" accent="#FFD479" primary title="Upgrade to Pro" sub="60 credits every day (3x Free) for $14.99 a month."
                  onPress={() => void checkout((r) => storeApi.subscribePro(r))} />
              )}
              <View style={{ gap: 6 }}>
                <Text style={s.label}>BUY CREDITS · NEVER EXPIRE</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CREDIT_PACKS.map((p) => (
                    <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Buy ${p.credits} credits for ${p.price}`}
                      onPress={() => void checkout((r) => storeApi.buyCredits(p.id, r))}
                      style={({ pressed }) => [s.pack, pressed && { opacity: 0.8 }]}>
                      <Text style={s.packCredits}>{p.credits}</Text>
                      <Text style={s.packPrice}>{p.price}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Option icon="key" accent="#86EFAC" title="Use your own AI account" sub="Sign in with OpenRouter (or add an API key) and chat on your own account with no daily limit."
                onPress={() => { close(); router.push("/(tabs)/connectors"); }} />
              {out && <Option icon="zap" accent={MG.violet} title="Try a lighter model" sub="Llama, DeepSeek and Gemini cost 1 credit per reply." onPress={close} />}
              <Option icon="trending-up" accent="#FF8A4C" title="Keep your streak going" sub="Day 3 of your 7-day streak adds +10 bonus credits." onPress={close} />
            </View>

            {costs.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={s.label}>CREDITS PER REPLY</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {costs.map(([id, cost]) => (
                    <View key={id} style={s.chip}>
                      <Text style={s.chipText}>{MODEL_NAMES[id]} · {data?.ownKeys?.includes(id) ? "free (your key)" : cost}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Option({ icon, accent, title, sub, onPress, primary }: { icon: React.ComponentProps<typeof Feather>["name"]; accent: string; title: string; sub: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.option, primary && s.optionPrimary, pressed && { opacity: 0.8 }]}>
      <View style={s.optionIcon}><Feather name={icon} size={18} color={accent} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(6,5,18,0.6)", justifyContent: "flex-end", padding: 12 },
  sheet: { maxHeight: "88%", borderRadius: 28, padding: 20, backgroundColor: "#211A4C", borderWidth: 1, borderColor: MG.glassBorder, width: "100%", maxWidth: 460, alignSelf: "center" },
  head: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { color: MG.ink, fontFamily: MGFont.display, fontSize: 21 },
  sub: { color: MG.ink2, fontFamily: MGFont.body, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)", backgroundColor: MG.glassFill },
  big: { color: MG.ink, fontFamily: MGFont.display, fontSize: 32 },
  of: { color: MG.ink2, fontFamily: MGFont.body, fontSize: 13.5 },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  option: { flexDirection: "row", gap: 12, alignItems: "center", padding: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  optionPrimary: { backgroundColor: "rgba(255,212,121,0.12)", borderColor: "rgba(255,212,121,0.4)" },
  optionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" },
  optionTitle: { color: MG.ink, fontFamily: MGFont.bold, fontSize: 14.5 },
  optionSub: { color: MG.ink2, fontFamily: MGFont.body, fontSize: 12.5, lineHeight: 17 },
  pack: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(255,212,121,0.1)", borderWidth: 1, borderColor: "rgba(255,212,121,0.35)" },
  packCredits: { color: MG.ink, fontFamily: MGFont.display, fontSize: 18 },
  packPrice: { color: "#FFD479", fontFamily: MGFont.bold, fontSize: 12.5 },
  label: { color: MG.ink3, fontFamily: MGFont.bold, fontSize: 10.5, letterSpacing: 1.2 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  chipText: { color: MG.ink2, fontFamily: MGFont.semi, fontSize: 12 },
});
