/**
 * MessageBubble — Animated chat message component.
 *
 * Slides up and fades in on mount. Supports user and AI roles
 * with distinct visual styles per the Apex design spec.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  type ViewStyle,
} from "react-native";

// ── Design tokens (hardcoded to the spec) ────────────────────────────────────
const USER_BUBBLE = "#6C5CE7";
const AI_BUBBLE   = "rgba(34,30,62,0.85)";
const TEXT_COLOR  = "#FFFFFF";
const AVATAR_BG   = "#2A2458";
const AVATAR_BORDER = "rgba(139,123,255,0.45)";

export interface ChatMessageData {
  id: string;
  text: string;
  role: "user" | "ai";
}

interface MessageBubbleProps {
  message: ChatMessageData;
  /** Hide the AI avatar (used in consecutive AI messages) */
  showAvatar?: boolean;
}

export function MessageBubble({ message, showAvatar = true }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // ── Entry animation ─────────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(10)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 22,
        stiffness: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAI,
        { opacity, transform: [{ translateY }] } as ViewStyle,
      ]}
    >
      {/* AI avatar */}
      {!isUser && showAvatar && <ApexAvatar />}
      {!isUser && !showAvatar && <View style={styles.avatarSpacer} />}

      {/* Bubble */}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? USER_BUBBLE : AI_BUBBLE,
            borderBottomRightRadius: isUser ? 4 : 18,
            borderBottomLeftRadius:  isUser ? 18 : 4,
          },
        ]}
      >
        <Text style={styles.bubbleText}>{message.text}</Text>
      </View>
    </Animated.View>
  );
}

// ── Apex "A" avatar ──────────────────────────────────────────────────────────
function ApexAvatar() {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>A</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const AVATAR_SIZE = 30;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  rowAI: {
    justifyContent: "flex-start",
  },

  // Avatar
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: AVATAR_BG,
    borderWidth: 1,
    borderColor: AVATAR_BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  avatarSpacer: {
    width: AVATAR_SIZE + 8,
  },

  // Bubble
  bubble: {
    maxWidth: "74%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_COLOR,
    fontWeight: "400",
  },
});
