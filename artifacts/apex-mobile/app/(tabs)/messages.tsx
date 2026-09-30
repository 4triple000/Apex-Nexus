/**
 * Chat — the Instagram / Messenger inbox (Meta messaging).
 */
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { Backdrop, Glass } from "@/components/glass/Glass";
import { BrandLogo } from "@/components/glass/BrandLogo";
import { MG, MGFont } from "@/constants/colors";
import { messagesApi, type DmConversation } from "@/services/api";

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function Row({ item }: { item: DmConversation }) {
  const c = item.dm_contacts;
  const name = c?.displayName || c?.username || "Unknown";
  const platform = c?.platform;
  const unread = item.dm_conversations.unreadCount ?? 0;
  return (
    <Glass radius={22} style={s.row}>
      <View style={s.rowAvatar}>
        <Text style={s.rowInitial}>{name[0]?.toUpperCase()}</Text>
        {platform === "instagram" || platform === "messenger" ? (
          <View style={s.rowBadge}><BrandLogo name={platform} size={12} /></View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowName} numberOfLines={1}>{name}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {platform === "demo" ? "Demo conversation" : c ? `@${c.username}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={s.rowTime}>{timeAgo(item.dm_conversations.lastMessageAt)}</Text>
        {unread > 0 ? <View style={s.unread}><Text style={s.unreadText}>{unread}</Text></View> : null}
      </View>
    </Glass>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const [showConnect, setShowConnect] = useState(true);
  const conversations = useQuery({ queryKey: ["dm-conversations"], queryFn: messagesApi.conversations, retry: 1 });
  const meta = useQuery({ queryKey: ["dm-meta"], queryFn: messagesApi.metaStatus, retry: 1 });
  const list = conversations.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: MG.bg }}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{ paddingTop: (Platform.OS === "web" ? 16 : insets.top + 6), paddingHorizontal: 16, paddingBottom: 130, gap: 14 }}
        refreshControl={<RefreshControl refreshing={conversations.isFetching} onRefresh={() => conversations.refetch()} tintColor={MG.ink2} />}
      >
        <View>
          <Text style={s.title}>Chat</Text>
          <View style={s.subRow}>
            <BrandLogo name="instagram" size={12} />
            <Text style={s.sub}>Instagram</Text>
            <Text style={s.sub}>·</Text>
            <BrandLogo name="messenger" size={12} />
            <Text style={s.sub}>Messenger</Text>
          </View>
        </View>

        {showConnect && meta.data && !meta.data.configured ? (
          <Glass radius={24} style={s.connect}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.connectTitle}>Connect your inboxes</Text>
                <Text style={s.connectBody}>Bring your Instagram and Facebook Messenger DMs into Apex.</Text>
              </View>
              <Pressable onPress={() => setShowConnect(false)} accessibilityLabel="Hide" hitSlop={8}>
                <Feather name="x" size={16} color={MG.ink3} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["instagram", "messenger"] as const).map((b) => (
                <View key={b} style={s.brandTile}>
                  <BrandLogo name={b} size={20} />
                  <View>
                    <Text style={s.brandName}>{b === "instagram" ? "Instagram" : "Messenger"}</Text>
                    <Text style={s.brandSub}>Coming soon</Text>
                  </View>
                </View>
              ))}
            </View>
          </Glass>
        ) : null}

        {conversations.isError ? (
          <Text style={s.empty}>Couldn't load conversations. Pull down to try again.</Text>
        ) : list.length === 0 && !conversations.isLoading ? (
          <View style={s.emptyBox}>
            <Glass radius={40} style={s.emptyIcon}><Feather name="message-circle" size={32} color={MG.ink} /></Glass>
            <Text style={s.emptyTitle}>No conversations yet</Text>
            <Text style={s.empty}>Once Instagram or Messenger is connected, your DMs show up here.</Text>
          </View>
        ) : (
          list.map((c) => <Row key={c.dm_conversations.id} item={c} />)
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  title: { color: MG.ink, fontSize: 28, fontFamily: MGFont.display, letterSpacing: -0.5 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  sub: { color: MG.ink3, fontSize: 13, fontFamily: MGFont.medium },
  connect: { padding: 16, gap: 12 },
  connectTitle: { color: MG.ink, fontSize: 15, fontFamily: MGFont.bold },
  connectBody: { color: MG.ink2, fontSize: 13, fontFamily: MGFont.body, marginTop: 3, lineHeight: 18 },
  brandTile: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  brandName: { color: MG.ink, fontSize: 13, fontFamily: MGFont.semi },
  brandSub: { color: MG.ink3, fontSize: 11, fontFamily: MGFont.body },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  rowAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#5B6CFF", alignItems: "center", justifyContent: "center" },
  rowInitial: { color: "#FFFFFF", fontSize: 17, fontFamily: MGFont.bold },
  rowBadge: { position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: "#16132C", alignItems: "center", justifyContent: "center" },
  rowName: { color: MG.ink, fontSize: 15, fontFamily: MGFont.semi },
  rowSub: { color: MG.ink3, fontSize: 12.5, fontFamily: MGFont.body, marginTop: 2 },
  rowTime: { color: MG.ink3, fontSize: 11, fontFamily: MGFont.medium },
  unread: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: MG.violet, alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#FFFFFF", fontSize: 11, fontFamily: MGFont.bold },
  emptyBox: { alignItems: "center", gap: 10, paddingTop: 50, paddingHorizontal: 20 },
  emptyIcon: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: MG.ink, fontSize: 17, fontFamily: MGFont.bold },
  empty: { color: MG.ink3, fontSize: 13, fontFamily: MGFont.body, textAlign: "center", lineHeight: 19 },
});
