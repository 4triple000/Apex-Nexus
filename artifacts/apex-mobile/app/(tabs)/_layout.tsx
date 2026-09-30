import { Tabs } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Glass } from "@/components/glass/Glass";
import { TabIcon, type TabIconName } from "@/components/glass/TabIcons";
import { MG } from "@/constants/colors";

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

// The five tabs, in order. "orb" stays reachable from the ☰ menu but has no tab.
const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: "index",    title: "Home",      icon: "home" },
  { name: "messages", title: "Chat",      icon: "chat" },
  { name: "builder",  title: "AI Studio", icon: "studio" },
  { name: "games",    title: "Games",     icon: "games" },
  { name: "profile",  title: "You",       icon: "you" },
];

/** Floating Midnight Glass tab bar (same on iOS, Android and web). */
function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: 16 + (Platform.OS === "web" ? 0 : insets.bottom) }]}>
      <Glass radius={32} intensity={50} style={styles.bar}>
        {TABS.map((tab) => {
          const i = state.routes.findIndex((r) => r.name === tab.name);
          if (i < 0) return null;
          const route = state.routes[i];
          const active = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.title}
              accessibilityState={{ selected: active }}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) {
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                  navigation.navigate(route.name);
                }
              }}
              style={({ pressed }) => [styles.tab, active && styles.tabOn, pressed && { transform: [{ scale: 0.93 }] }]}
            >
              <TabIcon name={tab.icon} color={active ? "#120F2A" : MG.ink} />
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: MG.bg } }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
      <Tabs.Screen name="orb" options={{ title: "Apex Orb", href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", zIndex: 100, elevation: 20 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "92%",
    maxWidth: 420,
    height: 64,
    paddingHorizontal: 8,
  },
  tab: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: "rgba(255,255,255,0.9)" },
});
