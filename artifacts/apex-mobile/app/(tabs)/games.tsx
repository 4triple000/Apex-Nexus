/**
 * Games — the Apex Games feed. Games play on the Apex website.
 */
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";

import { Backdrop, Glass } from "@/components/glass/Glass";
import { MG, MGFont } from "@/constants/colors";
import { gamesApi, WEB_APP_URL, type GameEntry } from "@/services/api";

const CARD_GRADIENTS: [string, string][] = [
  ["rgba(139,123,255,0.55)", "rgba(0,194,255,0.18)"],
  ["rgba(255,79,163,0.5)", "rgba(139,123,255,0.18)"],
  ["rgba(0,194,255,0.5)", "rgba(74,222,128,0.16)"],
];

const openGames = () => WebBrowser.openBrowserAsync(`${WEB_APP_URL}/games`);

function GameCard({ game, index }: { game: GameEntry; index: number }) {
  const [a, b] = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  return (
    <Pressable onPress={openGames} accessibilityLabel={`Play ${game.name}`} style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}>
      <Glass radius={26} style={s.card}>
        <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={s.cardTop}>
          <Text style={s.cardEmoji}>🎮</Text>
          <View style={s.play}><Feather name="play" size={14} color="#120F2A" /></View>
        </View>
        <Text style={s.cardTitle} numberOfLines={1}>{game.name}</Text>
        <Text style={s.cardSub} numberOfLines={1}>
          by {game.creatorName}{game.isRemix ? " · Remix" : ""}
        </Text>
        <View style={s.stats}>
          <Text style={s.stat}>▶ {game.playCount}</Text>
          <Text style={s.stat}>♥ {game.likeCount}</Text>
          {game.tags.slice(0, 2).map((t) => <Text key={t} style={s.tag}>#{t}</Text>)}
        </View>
      </Glass>
    </Pressable>
  );
}

export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const feed = useQuery({ queryKey: ["game-feed"], queryFn: gamesApi.feed, retry: 1 });
  const games = feed.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: MG.bg }}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{ paddingTop: (Platform.OS === "web" ? 16 : insets.top + 6), paddingHorizontal: 16, paddingBottom: 130, gap: 14 }}
        refreshControl={<RefreshControl refreshing={feed.isFetching} onRefresh={() => feed.refetch()} tintColor={MG.ink2} />}
      >
        <View>
          <Text style={s.title}>Apex Games</Text>
          <Text style={s.sub}>Play, remix and share games. Tap a game to play it.</Text>
        </View>
        {feed.isError ? (
          <Text style={s.sub}>Couldn't load games. Pull down to try again.</Text>
        ) : (
          games.map((g, i) => <GameCard key={g.id} game={g} index={i} />)
        )}
        <Pressable onPress={openGames}>
          <Glass radius={22} style={s.more}>
            <Feather name="external-link" size={16} color={MG.ink} />
            <Text style={s.moreText}>Open Apex Games</Text>
          </Glass>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  title: { color: MG.ink, fontSize: 28, fontFamily: MGFont.display, letterSpacing: -0.5 },
  sub: { color: MG.ink3, fontSize: 13, fontFamily: MGFont.medium, marginTop: 4 },
  card: { padding: 18, gap: 4, minHeight: 150, justifyContent: "flex-end" },
  cardTop: { position: "absolute", top: 16, left: 18, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardEmoji: { fontSize: 30 },
  play: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  cardTitle: { color: MG.ink, fontSize: 20, fontFamily: MGFont.display, letterSpacing: -0.3 },
  cardSub: { color: MG.ink2, fontSize: 13, fontFamily: MGFont.body },
  stats: { flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap" },
  stat: { color: MG.ink2, fontSize: 12, fontFamily: MGFont.semi },
  tag: { color: MG.ink3, fontSize: 12, fontFamily: MGFont.medium },
  more: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48 },
  moreText: { color: MG.ink, fontSize: 14, fontFamily: MGFont.semi },
});
