/**
 * Connectors — link your own AI accounts (free, unlimited replies on your key) and apps
 * (Google Calendar & Drive, GitHub, Spotify…) so Apex can use them in chat.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Backdrop } from "@/components/glass/Glass";
import { MG, MGFont } from "@/constants/colors";
import { connectorsApi, type Connector } from "@/services/api";

const SECTIONS: { id: Connector["category"]; title: string; sub: string }[] = [
  { id: "ai", title: "YOUR AI ACCOUNTS", sub: "Chat on your own AI account instead of Apex credits: no daily limits, billed by the provider." },
  { id: "voice", title: "VOICE", sub: "Use your own voice plan for game characters." },
  { id: "apps", title: "APPS", sub: "Let Apex read from your accounts when you ask about them." },
];

export default function ConnectorsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["connectors"], queryFn: connectorsApi.list });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["connectors"] });
    void qc.invalidateQueries({ queryKey: ["credits"] });
  };

  // Website version: back from linking an app (?connected=github)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setNotice("Linked.");
    else if (params.get("connect_error")) setNotice(params.get("connect_error") === "cancelled" ? "Linking was cancelled." : "That couldn't be linked. Try again.");
    if (params.get("connected") || params.get("connect_error")) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120, paddingHorizontal: 16, gap: 18 }}>
        <View style={s.headerRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} accessibilityLabel="Back" style={s.back}>
            <Feather name="chevron-left" size={20} color={MG.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Connectors</Text>
            <Text style={s.sub}>Bring your own AI subscriptions and apps into Apex.</Text>
          </View>
        </View>
        <View style={s.privacy}>
          <Feather name="shield" size={14} color={MG.ink3} />
          <Text style={s.privacyText}>Keys and tokens are encrypted and only used for your own requests. Unlink any time.</Text>
        </View>

        {notice && <Text style={s.notice}>{notice}</Text>}
        {isLoading && <ActivityIndicator color={MG.violet} />}
        {error && <Text style={s.error}>{(error as Error).message}</Text>}

        {SECTIONS.map((section) => {
          const items = (data ?? []).filter((c) => c.category === section.id);
          if (!items.length) return null;
          const featured = items.filter((c) => c.featured);
          const keys = items.filter((c) => !c.featured);
          const fold = section.id === "ai" && featured.length > 0;
          const keysOpen = showKeys || keys.some((c) => c.linked);
          return (
            <View key={section.id} style={{ gap: 10 }}>
              <View>
                <Text style={s.label}>{section.title}</Text>
                <Text style={s.sectionSub}>{section.sub}</Text>
              </View>
              {featured.map((c) => <ConnectorCard key={c.id} c={c} onChange={refresh} />)}
              {fold && (
                <Pressable onPress={() => setShowKeys((v) => !v)} accessibilityState={{ expanded: keysOpen }} style={s.foldBtn}>
                  <Feather name="key" size={14} color={MG.ink2} />
                  <Text style={s.foldText}>Or paste an API key from one provider</Text>
                  <Feather name={keysOpen ? "chevron-up" : "chevron-down"} size={14} color={MG.ink2} />
                </Pressable>
              )}
              {(!fold || keysOpen) && keys.map((c) => <ConnectorCard key={c.id} c={c} onChange={refresh} />)}
            </View>
          );
        })}

        <Text style={s.footnote}>
          Why not your ChatGPT Plus or Claude Pro login? Those plans only work inside OpenAI's and Anthropic's own apps; they don't let other apps use them. OpenRouter and API keys are pay-as-you-go instead, usually a few cents per chat.
        </Text>
      </ScrollView>
    </View>
  );
}

function ConnectorCard({ c, onChange }: { c: Connector; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkKey = async () => {
    setBusy(true); setError(null);
    try {
      await connectorsApi.addKey(c.id, key.trim());
      setKey(""); setOpen(false); onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't link that key.");
    } finally {
      setBusy(false);
    }
  };

  const linkApp = async () => {
    setBusy(true); setError(null);
    try {
      if (Platform.OS === "web") {
        window.location.href = await connectorsApi.authorize(c.id, `${window.location.origin}/connectors`);
        return;
      }
      const returnTo = "apex-mobile://connectors";
      const url = await connectorsApi.authorize(c.id, returnTo);
      const result = await WebBrowser.openAuthSessionAsync(url, returnTo);
      if (result.type === "success" && result.url.includes("connect_error")) setError("That couldn't be linked. Try again.");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start linking.");
    } finally {
      setBusy(false);
    }
  };

  const unlink = () => {
    const go = async () => {
      setBusy(true);
      try { await connectorsApi.remove(c.id); onChange(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't unlink."); } finally { setBusy(false); }
    };
    if (Platform.OS === "web") { void go(); return; }
    Alert.alert(`Unlink ${c.name}?`, undefined, [{ text: "Cancel", style: "cancel" }, { text: "Unlink", style: "destructive", onPress: () => void go() }]);
  };

  return (
    <View style={[s.card, c.featured && s.cardFeatured]}>
      <View style={s.row}>
        <View style={[s.dot, { borderColor: c.color }]}><Text style={[s.dotText, { color: c.color }]}>{c.name[0]}</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.name}>{c.name}</Text>
          {c.linked && <Text style={s.linked}>✓ Linked{c.accountLabel ? ` · ${c.accountLabel}` : ""}</Text>}
          {c.featured && !c.linked && <Text style={s.recommended}>★ Recommended</Text>}
          {!c.available && !c.linked && <Text style={s.soon}>Coming soon</Text>}
          <Text style={s.desc}>{c.linked ? c.unlocks : c.description}</Text>
        </View>
        {c.linked ? (
          <Pressable onPress={unlink} disabled={busy} style={[s.btn, s.btnGhost]} accessibilityLabel={`Unlink ${c.name}`}>
            {busy ? <ActivityIndicator size="small" color={MG.ink} /> : <Text style={s.btnGhostText}>Unlink</Text>}
          </Pressable>
        ) : c.kind === "key" ? (
          <Pressable onPress={() => setOpen((o) => !o)} style={s.btn} accessibilityState={{ expanded: open }}>
            <Text style={s.btnText}>{open ? "Cancel" : "Add key"}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={linkApp} disabled={busy || !c.available} style={[s.btn, !c.available && { opacity: 0.45 }]}>
            {busy ? <ActivityIndicator size="small" color="#1C1640" /> : <Text style={s.btnText}>{c.kind === "signin" ? "Sign in" : "Connect"}</Text>}
          </Pressable>
        )}
      </View>

      {open && !c.linked && c.kind === "key" && (
        <View style={{ gap: 8 }}>
          <Text style={s.desc}>{c.unlocks}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false}
              placeholder={c.keyHint ? `Paste your key (${c.keyHint})` : "Paste your API key"} placeholderTextColor={MG.ink3}
              accessibilityLabel={`${c.name} API key`} style={s.input}
            />
            <Pressable onPress={linkKey} disabled={busy || !key.trim()} style={[s.btn, !key.trim() && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator size="small" color="#1C1640" /> : <Text style={s.btnText}>Link</Text>}
            </Pressable>
          </View>
          {c.keyUrl && (
            <Text style={s.linkText} onPress={() => void Linking.openURL(c.keyUrl!)}>Get a key from {c.name.split(" (")[0]} ↗</Text>
          )}
        </View>
      )}
      {error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.34)", backgroundColor: MG.glassFill },
  title: { color: MG.ink, fontFamily: MGFont.display, fontSize: 26 },
  sub: { color: MG.ink2, fontFamily: MGFont.body, fontSize: 13.5, marginTop: 2 },
  privacy: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  privacyText: { flex: 1, color: MG.ink3, fontFamily: MGFont.body, fontSize: 12.5, lineHeight: 17 },
  notice: { color: "#86EFAC", fontFamily: MGFont.semi, fontSize: 13.5 },
  label: { color: MG.ink3, fontFamily: MGFont.bold, fontSize: 10.5, letterSpacing: 1.2 },
  sectionSub: { color: MG.ink2, fontFamily: MGFont.body, fontSize: 13, marginTop: 4, lineHeight: 18 },
  cardFeatured: { backgroundColor: "rgba(139,123,255,0.22)", borderColor: "rgba(139,123,255,0.55)" },
  recommended: { color: "#FFD479", fontFamily: MGFont.bold, fontSize: 12 },
  foldBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  foldText: { color: MG.ink2, fontFamily: MGFont.semi, fontSize: 13 },
  card: { borderRadius: 22, padding: 14, gap: 10, backgroundColor: MG.glassFill, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, backgroundColor: "rgba(255,255,255,0.06)" },
  dotText: { fontFamily: MGFont.display, fontSize: 18 },
  name: { color: MG.ink, fontFamily: MGFont.bold, fontSize: 15 },
  linked: { color: "#86EFAC", fontFamily: MGFont.bold, fontSize: 12 },
  soon: { color: MG.ink3, fontFamily: MGFont.semi, fontSize: 12 },
  desc: { color: MG.ink2, fontFamily: MGFont.body, fontSize: 12.5, lineHeight: 17 },
  btn: { height: 36, paddingHorizontal: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  btnText: { color: "#1C1640", fontFamily: MGFont.bold, fontSize: 13 },
  btnGhost: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  btnGhostText: { color: MG.ink, fontFamily: MGFont.bold, fontSize: 13 },
  input: { flex: 1, height: 40, borderRadius: 12, paddingHorizontal: 12, color: MG.ink, fontFamily: MGFont.body, fontSize: 14, backgroundColor: "rgba(0,0,0,0.25)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  linkText: { color: "#A5B4FC", fontFamily: MGFont.semi, fontSize: 12.5 },
  error: { color: "#FCA5A5", fontFamily: MGFont.semi, fontSize: 12.5 },
  footnote: { color: MG.ink3, fontFamily: MGFont.body, fontSize: 12.5, lineHeight: 18 },
});
