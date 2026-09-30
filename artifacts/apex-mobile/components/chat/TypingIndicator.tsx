/**
 * TypingIndicator — "Apex is thinking…" animated dots.
 *
 * Three dots that pulse sequentially to signal the AI is generating a response.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

const AI_BUBBLE   = "rgba(34,30,62,0.85)";
const AVATAR_BG   = "#2A2458";
const AVATAR_BORDER = "rgba(139,123,255,0.45)";
const DOT_COLOR   = "#9CA3AF";

function PulsingDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View style={[styles.dot, { opacity }]} />
  );
}

export function TypingIndicator() {
  const translateY = useRef(new Animated.Value(8)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[styles.row, { opacity, transform: [{ translateY }] }]}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>A</Text>
      </View>

      {/* Bubble with dots */}
      <View style={styles.bubble}>
        <PulsingDot delay={0} />
        <PulsingDot delay={180} />
        <PulsingDot delay={360} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AVATAR_BG,
    borderWidth: 1,
    borderColor: AVATAR_BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  bubble: {
    backgroundColor: AI_BUBBLE,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: DOT_COLOR,
  },
});
