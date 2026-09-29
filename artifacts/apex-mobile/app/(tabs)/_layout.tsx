import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Glass } from "@/components/glass/Glass";
import { MG } from "@/constants/colors";

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: { name: string; title: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { name: "index",   title: "Home",      icon: "home" },
  { name: "builder", title: "AI Studio", icon: "code" },
  { name: "orb",     title: "Apex Orb",  icon: "aperture" },
  { name: "profile", title: "You",       icon: "user" },
];

/** iOS 26+: Apple's own Liquid Glass tab bar. */
function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="builder">
        <Icon sf={{ default: "sparkles", selected: "sparkles" }} />
        <Label>AI Studio</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orb">
        <Icon sf={{ default: "circle.hexagonpath", selected: "circle.hexagonpath.fill" }} />
        <Label>Apex Orb</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>You</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

/** Everywhere else: a floating Midnight Glass pill. */
function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: 16 + (Platform.OS === "web" ? 0 : insets.bottom) }]}>
      <Glass radius={33} intensity={60} style={styles.bar}>
        {state.routes.map((route, i) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
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
              style={[styles.tab, active && styles.tabOn]}
            >
              <Feather name={tab.icon} size={22} color={active ? "#120F2A" : MG.ink2} />
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

function ClassicTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: MG.bg } }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "92%",
    maxWidth: 420,
    height: 66,
    paddingHorizontal: 9,
    backgroundColor: "rgba(26,22,56,0.55)",
  },
  tab: { width: 52, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  tabOn: {
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: MG.violet,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
