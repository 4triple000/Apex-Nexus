/**
 * Home — Midnight Glass hub and chat.
 *
 * Empty state: menu, greeting, model search, Chat / Battle / Hive chips and a
 * swipeable card per AI model. Once a message is sent the screen becomes the
 * conversation, with the chosen model shown in the header.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { Backdrop, Glass } from "@/components/glass/Glass";
import { ModelLogo, MODEL_COLORS, type ModelId } from "@/components/glass/ModelLogo";
import { MessageBubble, type ChatMessageData } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { MG, MGFont } from "@/constants/colors";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { chatApi, screenshotApi } from "@/services/api";
import { recordPrompt, usePromptLibrary } from "@/lib/promptLibrary";
import { UsagePill } from "@/components/glass/UsagePill";
import * as ImagePicker from "expo-image-picker";

type ChatMode = "chat" | "battle" | "hive";

const MODELS: { id: ModelId; name: string; maker: string; tagline: string; aliases: string[] }[] = [
  { id: "auto",       name: "Apex Auto",  maker: "Apex",       tagline: "Picks the best model for each message", aliases: ["auto", "apex", "best"] },
  { id: "openai",     name: "ChatGPT",    maker: "OpenAI",     tagline: "Fast, all-round everyday answers",      aliases: ["gpt", "chatgpt", "openai"] },
  { id: "claude",     name: "Claude",     maker: "Anthropic",  tagline: "Deep reasoning, writing and code",      aliases: ["claude", "anthropic", "opus", "sonnet"] },
  { id: "perplexity", name: "Perplexity", maker: "Perplexity", tagline: "Live web research with sources",        aliases: ["perplexity", "sonar", "search", "web"] },
];

const MODES: { id: ChatMode; label: string; sub: string }[] = [
  { id: "chat",   label: "Chat",   sub: "One model answers" },
  { id: "battle", label: "Battle", sub: "Every model answers, compare them" },
  { id: "hive",   label: "Hive",   sub: "Models team up on one answer" },
];

const NAMES: Record<string, string> = { openai: "ChatGPT", claude: "Claude", perplexity: "Perplexity", hive: "Hive" };

const TAB_BAR_SPACE = 96;

function tap() {
  if (Platform.OS !== "web") Haptics.selectionAsync();
}

// ── Header ─────────────────────────────────────────────────────────────────────

function Header({ name, onMenu, onAvatar }: { name: string; onMenu: () => void; onAvatar: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <View style={s.headerRow}>
      <Pressable onPress={onMenu} accessibilityLabel="Menu" hitSlop={6}>
        <Glass radius={21} style={s.circleBtn}>
          <Feather name="menu" size={19} color={MG.ink} />
        </Glass>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.greetSmall}>{greeting}</Text>
        <Text style={s.greetBig} numberOfLines={1}>Hey, {name}</Text>
      </View>
      <Pressable onPress={onAvatar} accessibilityLabel="Your profile" style={s.avatar}>
        <LinearGradient colors={["#8B7BFF", "#00C2FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={s.avatarText}>{name.trim()[0]?.toUpperCase() ?? "A"}</Text>
      </Pressable>
    </View>
  );
}

// ── Search ─────────────────────────────────────────────────────────────────────

function Search({
  onPickModel, onPickMode, onAsk,
}: {
  onPickModel: (id: ModelId) => void;
  onPickMode: (m: ChatMode) => void;
  onAsk: (text: string) => void;
}) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const query = q.trim().toLowerCase();

  const library = usePromptLibrary("chat");
  const results = useMemo(() => {
    const hit = (label: string, aliases: string[]) =>
      !query || label.toLowerCase().includes(query) || aliases.some((a) => a.includes(query) || query.includes(a));
    const models = MODELS.filter((m) => hit(m.name, m.aliases));
    const modes = query ? MODES.filter((m) => hit(m.label, [m.id])) : [];
    const match = (t: string) => !query || t.toLowerCase().includes(query);
    const saved = library.saved.filter((p) => match(p.text)).slice(0, 3);
    const recent = library.history.filter((p) => match(p.text) && !library.isSaved(p.text)).slice(0, 3);
    return { models, modes, saved, recent };
  }, [query, library.saved, library.history, library.isSaved]);

  const done = () => { setQ(""); setFocused(false); };

  return (
    <View style={{ zIndex: 20 }}>
      <Glass radius={23} style={s.search}>
        <Feather name="search" size={16} color={MG.ink2} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onSubmitEditing={() => {
            if (results.models.length === 1 && query) onPickModel(results.models[0].id);
            else if (q.trim()) onAsk(q.trim());
            done();
          }}
          placeholder="Search a model, or ask Apex…"
          placeholderTextColor={MG.ink3}
          returnKeyType="search"
          style={s.searchInput}
        />
      </Glass>
      {focused && (results.models.length > 0 || results.modes.length > 0 || query) ? (
        <View style={s.dropdown}>
          {[...results.saved.map((p) => ({ ...p, saved: true })), ...results.recent.map((p) => ({ ...p, saved: false }))].map((p) => (
            <Pressable key={`p-${p.text}`} style={s.result} onPress={() => { onAsk(p.text); done(); }}>
              <View style={s.resultIcon}><Feather name={p.saved ? "star" : "clock"} size={15} color={p.saved ? "#FFD479" : MG.ink2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.resultTitle} numberOfLines={1}>{p.text}</Text>
                <Text style={s.resultSub}>{p.saved ? "Saved prompt" : "Recent"} · tap to send</Text>
              </View>
              <Pressable onPress={() => library.toggleSaved(p.text)} hitSlop={8} accessibilityLabel={p.saved ? "Remove from saved" : "Save prompt"}>
                <Feather name="star" size={15} color={p.saved ? "#FFD479" : MG.ink3} />
              </Pressable>
            </Pressable>
          ))}
          {results.models.map((m) => (
            <Pressable key={m.id} style={s.result} onPress={() => { onPickModel(m.id); done(); }}>
              <View style={s.resultIcon}><ModelLogo id={m.id} size={18} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.resultTitle}>{m.name}</Text>
                <Text style={s.resultSub}>{m.tagline}</Text>
              </View>
            </Pressable>
          ))}
          {results.modes.map((m) => (
            <Pressable key={m.id} style={s.result} onPress={() => { onPickMode(m.id); done(); }}>
              <View style={s.resultIcon}><Text>{m.id === "battle" ? "⚔️" : m.id === "hive" ? "🐝" : "💬"}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.resultTitle}>{m.label} mode</Text>
                <Text style={s.resultSub}>{m.sub}</Text>
              </View>
            </Pressable>
          ))}
          {query ? (
            <Pressable style={s.result} onPress={() => { onAsk(q.trim()); done(); }}>
              <View style={s.resultIcon}><Feather name="zap" size={16} color={MG.violet} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.resultTitle} numberOfLines={1}>Ask Apex “{q.trim()}”</Text>
                <Text style={s.resultSub}>Send as a message</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ── Chips ──────────────────────────────────────────────────────────────────────

function ModeChips({ mode, onChange, onScreenshot }: { mode: ChatMode; onChange: (m: ChatMode) => void; onScreenshot: () => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {MODES.map((m) => {
        const on = m.id === mode;
        return (
          <Pressable
            key={m.id}
            onPress={() => { tap(); onChange(m.id); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.chip, on && s.chipOn]}
          >
            <Text style={[s.chipText, on && s.chipTextOn]}>{m.label}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => { tap(); onScreenshot(); }} accessibilityLabel="Analyze a screenshot" style={[s.chip, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
        <Feather name="image" size={14} color={MG.ink2} />
        <Text style={s.chipText}>Screenshot</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Model carousel ─────────────────────────────────────────────────────────────

function StatusPill({ connected }: { connected: boolean | undefined }) {
  if (connected === undefined) return null;
  return (
    <View style={[s.pill, connected ? s.pillOn : null]}>
      <View style={[s.pillDot, { backgroundColor: connected ? "#4ADE80" : "rgba(255,255,255,0.35)" }]} />
      <Text style={[s.pillText, { color: connected ? "#86EFAC" : MG.ink3 }]}>
        {connected ? "Connected" : "Not connected yet"}
      </Text>
    </View>
  );
}

function ModelCarousel({
  value, onChange, status, width,
}: {
  value: ModelId;
  onChange: (id: ModelId) => void;
  status: Partial<Record<ModelId, boolean>> | undefined;
  width: number;
}) {
  const listRef = useRef<FlatList<(typeof MODELS)[number]>>(null);
  const index = Math.max(0, MODELS.findIndex((m) => m.id === value));

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: index * width, animated: true });
  }, [index, width]);

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    const m = MODELS[Math.min(Math.max(i, 0), MODELS.length - 1)];
    if (m.id !== value) { tap(); onChange(m.id); }
  };

  const go = (d: number) => onChange(MODELS[(index + d + MODELS.length) % MODELS.length].id);

  return (
    <View style={{ gap: 10 }}>
      <Glass radius={30} style={{ width }}>
        <FlatList
          ref={listRef}
          data={MODELS}
          keyExtractor={(m) => m.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onSettle}
          // Web has no momentum events; settle on scroll end instead
          onScrollEndDrag={Platform.OS === "web" ? onSettle : undefined}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          initialScrollIndex={index}
          renderItem={({ item }) => (
            <View style={[s.slide, { width }]} accessibilityLabel={`${item.name}. ${item.tagline}`}>
              <LinearGradient
                pointerEvents="none"
                colors={[`${MODEL_COLORS[item.id]}66`, "rgba(0,194,255,0.14)"]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.logoTile, { shadowColor: MODEL_COLORS[item.id] }]}>
                <ModelLogo id={item.id} size={item.id === "auto" ? 60 : 50} />
              </View>
              <View style={s.slideRow}>
                <Text style={s.slideTitle}>{item.name}</Text>
                <StatusPill connected={status?.[item.id]} />
              </View>
              <Text style={s.slideSub}>
                <Text style={{ color: MG.ink3 }}>{item.maker} · </Text>{item.tagline}
              </Text>
            </View>
          )}
        />
        <Pressable onPress={() => go(-1)} accessibilityLabel="Previous model" style={[s.arrow, { left: 10 }]}>
          <Glass radius={17} style={s.arrowInner}><Feather name="chevron-left" size={18} color={MG.ink} /></Glass>
        </Pressable>
        <Pressable onPress={() => go(1)} accessibilityLabel="Next model" style={[s.arrow, { right: 10 }]}>
          <Glass radius={17} style={s.arrowInner}><Feather name="chevron-right" size={18} color={MG.ink} /></Glass>
        </Pressable>
      </Glass>
      <View style={s.dots}>
        {MODELS.map((m, i) => (
          <View key={m.id} style={[s.dot, i === index && s.dotOn]} />
        ))}
      </View>
    </View>
  );
}

function ModeCard({ mode, status }: { mode: "battle" | "hive"; status: Partial<Record<ModelId, boolean>> | undefined }) {
  const models: ModelId[] = ["openai", "claude", "perplexity"];
  const connected = status ? models.filter((m) => status[m]).length : undefined;
  const body = mode === "battle"
    ? "Every connected model answers the same message, so you can compare them side by side."
    : "Every connected model answers, then Apex blends the best parts into one answer.";
  return (
    <Glass radius={30} style={s.modeCard}>
      <LinearGradient
        pointerEvents="none"
        colors={mode === "battle" ? ["rgba(255,107,107,0.4)", "rgba(0,194,255,0.12)"] : ["rgba(139,123,255,0.45)", "rgba(0,194,255,0.14)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.logoStack}>
        {models.map((m, i) => (
          <View key={m} style={[s.stackTile, { marginLeft: i ? -12 : 0, opacity: status && !status[m] ? 0.45 : 1 }]}>
            <ModelLogo id={m} size={30} />
          </View>
        ))}
      </View>
      <View style={s.slideRow}>
        <Text style={s.slideTitle}>{mode === "battle" ? "Battle" : "Hive"}</Text>
        {connected !== undefined ? <Text style={s.connectedCount}>{connected} of 3 connected</Text> : null}
      </View>
      <Text style={s.slideSub}>{body}</Text>
    </Glass>
  );
}

// ── Menu sheet ─────────────────────────────────────────────────────────────────

function MenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { logout } = useAuth();
  const items: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; onPress: () => void }[] = [
    { icon: "home",           label: "Home",       onPress: () => router.navigate("/(tabs)") },
    { icon: "message-circle", label: "Chat",       onPress: () => router.navigate("/(tabs)/messages") },
    { icon: "star",           label: "Builder",    onPress: () => router.navigate("/(tabs)/builder") },
    { icon: "play-circle",    label: "Games",      onPress: () => router.navigate("/(tabs)/games") },
    { icon: "aperture",       label: "Apex Orb",   onPress: () => router.navigate("/(tabs)/orb") },
    { icon: "user",           label: "You",        onPress: () => router.navigate("/(tabs)/profile") },
    { icon: "log-out",        label: "Sign out",   onPress: () => { logout(); } },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.menuBackdrop} onPress={onClose}>
        <Glass radius={28} intensity={70} style={s.menu}>
          <Text style={s.menuTitle}>Apex</Text>
          {items.map((it) => (
            <Pressable key={it.label} style={s.menuItem} onPress={() => { onClose(); it.onPress(); }}>
              <Feather name={it.icon} size={18} color={MG.ink2} />
              <Text style={s.menuLabel}>{it.label}</Text>
            </Pressable>
          ))}
        </Glass>
      </Pressable>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cardWidth = Math.min(width, 520) - 32;

  const [mode, setMode] = useState<ChatMode>("chat");
  const [model, setModel] = useState<ModelId>("auto");
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<ScrollView>(null);

  const { data: providers } = useQuery({ queryKey: ["providers"], queryFn: chatApi.providers, staleTime: 60_000, retry: 1 });
  const status = providers
    ? { ...providers, auto: providers.openai || providers.claude || providers.perplexity }
    : undefined;

  const push = (m: Omit<ChatMessageData, "id">) =>
    setMessages((prev) => [...prev, { ...m, id: `${Date.now()}-${Math.random()}` }]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setDraft("");
    push({ role: "user", text });
    recordPrompt(text, "chat");
    setSending(true);
    try {
      if (mode === "chat") {
        const r = await chatApi.send({ message: text, conversationId, provider: model });
        setConversationId(r.conversationId);
        push({ role: "ai", text: r.content });
      } else {
        const r = await chatApi.group(text, mode, user?.sessionId);
        if (mode === "hive") {
          push({ role: "ai", text: r.combinedAnswer ?? "No answer." });
        } else {
          for (const a of r.messages) {
            push({ role: "ai", text: `${NAMES[a.provider] ?? a.provider}\n${a.error ?? a.content}` });
          }
        }
      }
    } catch (e) {
      push({ role: "ai", text: e instanceof Error ? e.message : "Something went wrong. Try again." });
    } finally {
      setSending(false);
      queryClient.invalidateQueries({ queryKey: ["daily-usage"] });
    }
  }, [mode, model, conversationId, sending, user?.sessionId, queryClient]);

  // Screenshot chip: pick an image, get a read on it and three reply ideas
  const analyzeScreenshot = useCallback(async () => {
    const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.6 });
    if (pick.canceled || !pick.assets[0]?.base64) return;
    push({ role: "user", text: "📸 Analyze this screenshot" });
    setSending(true);
    try {
      const r = await screenshotApi.analyze(pick.assets[0].base64);
      const ideas = r.suggestions.map((x, i) => `${i + 1}. ${x}`).join("\n");
      push({ role: "ai", text: `${r.analysis}${ideas ? `\n\nReply ideas:\n${ideas}` : ""}` });
    } catch (e) {
      push({ role: "ai", text: e instanceof Error ? e.message : "Couldn't analyze that image." });
    } finally {
      setSending(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length, sending]);

  const newChat = () => { setMessages([]); setConversationId(undefined); };
  const current = MODELS.find((m) => m.id === model) ?? MODELS[0];
  const topPad = Platform.OS === "web" ? 16 : insets.top + 6;

  return (
    <View style={{ flex: 1, backgroundColor: MG.bg }}>
      <Backdrop />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={[s.top, { paddingTop: topPad }]}>
          {messages.length === 0 ? (
            <Header name={user?.username || "Creator"} onMenu={() => setMenuOpen(true)} onAvatar={() => router.navigate("/(tabs)/profile")} />
          ) : (
            <View style={s.headerRow}>
              <Pressable onPress={() => setMenuOpen(true)} accessibilityLabel="Menu">
                <Glass radius={21} style={s.circleBtn}><Feather name="menu" size={19} color={MG.ink} /></Glass>
              </Pressable>
              <Pressable onPress={newChat} accessibilityLabel="New chat">
                <Glass radius={21} style={s.modelBadge}>
                  {mode === "chat" ? <ModelLogo id={model} size={18} /> : <Text>{mode === "battle" ? "⚔️" : "🐝"}</Text>}
                  <Text style={s.modelBadgeText}>{mode === "chat" ? current.name : mode === "battle" ? "Battle" : "Hive"}</Text>
                  <Text style={s.modelBadgeSub}>{sending ? "thinking…" : "New chat"}</Text>
                </Glass>
              </Pressable>
            </View>
          )}
        </View>

        <ScrollView
          ref={listRef}
          style={{ flex: 1 }}
          contentContainerStyle={[s.body, { paddingBottom: 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={{ gap: 16, alignItems: "center" }}>
              <View style={{ width: cardWidth, gap: 16, zIndex: 20 }}>
                <View style={{ marginTop: -10, marginBottom: -6 }}><UsagePill /></View>
                <Search
                  onPickModel={(id) => { setMode("chat"); setModel(id); }}
                  onPickMode={setMode}
                  onAsk={send}
                />
                <ModeChips mode={mode} onChange={setMode} onScreenshot={analyzeScreenshot} />
              </View>
              {mode === "chat"
                ? <ModelCarousel value={model} onChange={setModel} status={status} width={cardWidth} />
                : <View style={{ width: cardWidth }}><ModeCard mode={mode} status={status} /></View>}
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              {messages.map((m, i) => (
                <MessageBubble key={m.id} message={m} showAvatar={m.role === "ai" && messages[i - 1]?.role !== "ai"} />
              ))}
              {sending ? <TypingIndicator /> : null}
            </View>
          )}
        </ScrollView>

        <View style={{ paddingBottom: TAB_BAR_SPACE + (Platform.OS === "web" ? 0 : insets.bottom) }}>
          <ChatInput
            value={draft}
            onChangeText={setDraft}
            onSend={() => send(draft)}
            disabled={sending}
            placeholder={mode === "chat" ? `Message ${current.name}…` : mode === "battle" ? "Ask every model…" : "Ask the Hive…"}
          />
        </View>
      </KeyboardAvoidingView>
      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingBottom: 10, zIndex: 10 },
  body: { paddingHorizontal: 16, paddingTop: 4 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  circleBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  greetSmall: { fontSize: 12, color: MG.ink3, fontFamily: MGFont.medium },
  greetBig: { fontSize: 19, color: MG.ink, fontFamily: MGFont.display, letterSpacing: -0.4 },
  avatar: { width: 42, height: 42, borderRadius: 21, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  avatarText: { color: "#FFFFFF", fontSize: 16, fontFamily: MGFont.bold },

  modelBadge: { flexDirection: "row", alignItems: "center", gap: 8, height: 42, paddingLeft: 12, paddingRight: 16 },
  modelBadgeText: { color: MG.ink, fontSize: 14, fontFamily: MGFont.semi },
  modelBadgeSub: { color: MG.ink3, fontSize: 11, fontFamily: MGFont.semi },

  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, paddingHorizontal: 16 },
  searchInput: {
    flex: 1, minWidth: 0, height: 44, color: MG.ink, fontSize: 15, fontFamily: MGFont.body, paddingVertical: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  dropdown: { position: "absolute", top: 54, left: 0, right: 0, borderRadius: 22, padding: 6, backgroundColor: "rgba(22,19,44,0.98)", borderWidth: 1, borderColor: MG.glassBorder },
  result: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16 },
  resultIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  resultTitle: { color: MG.ink, fontSize: 14, fontFamily: MGFont.semi },
  resultSub: { color: MG.ink3, fontSize: 12, fontFamily: MGFont.body },

  chips: { flexDirection: "row", gap: 8 },
  chip: { height: 36, paddingHorizontal: 18, borderRadius: 18, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  chipOn: { backgroundColor: "rgba(255,255,255,0.92)", borderColor: "transparent" },
  chipText: { color: MG.ink2, fontSize: 13.5, fontFamily: MGFont.semi },
  chipTextOn: { color: "#120F2A" },

  slide: { minHeight: 236, padding: 22, justifyContent: "flex-end", gap: 6 },
  logoTile: {
    position: "absolute", top: 26, left: "50%", marginLeft: -46,
    width: 92, height: 92, borderRadius: 28, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
  },
  slideRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  slideTitle: { color: MG.ink, fontSize: 24, fontFamily: MGFont.display, letterSpacing: -0.5 },
  slideSub: { color: MG.ink2, fontSize: 13.5, fontFamily: MGFont.body, lineHeight: 19 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  pillOn: { backgroundColor: "rgba(74,222,128,0.14)", borderColor: "rgba(74,222,128,0.3)" },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11.5, fontFamily: MGFont.semi },
  arrow: { position: "absolute", top: "42%" },
  arrowInner: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MG.ink, opacity: 0.28 },
  dotOn: { width: 20, opacity: 0.9 },

  modeCard: { padding: 22, minHeight: 236, justifyContent: "space-between", gap: 12 },
  logoStack: { flexDirection: "row", justifyContent: "center", paddingTop: 6 },
  stackTile: { width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(24,20,48,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  connectedCount: { color: MG.ink3, fontSize: 12, fontFamily: MGFont.semi },

  menuBackdrop: { flex: 1, backgroundColor: "rgba(5,4,14,0.55)", padding: 16, paddingTop: 70 },
  menu: { padding: 10, width: 240 },
  menuTitle: { color: MG.ink3, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: MGFont.bold, padding: 10 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14 },
  menuLabel: { color: MG.ink, fontSize: 15, fontFamily: MGFont.medium },
});
