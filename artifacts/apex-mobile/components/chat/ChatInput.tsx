/**
 * ChatInput — Fixed-bottom input bar for the Apex chat screen.
 *
 * Features:
 * - "+" button on left (for future attachments/features)
 * - Auto-growing multiline text input
 * - Animated send button (blue when active, gray when empty)
 * - Focus ring on the input container
 */

import React, { useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BACKGROUND      = "#0D0D0D";
const CONTAINER_BG    = "#161B22";
const BORDER_DEFAULT  = "#2A2A2A";
const BORDER_FOCUSED  = "#2563EB";
const PLACEHOLDER_CLR = "#6B7280";
const TEXT_COLOR      = "#FFFFFF";
const SEND_ACTIVE     = "#2563EB";
const SEND_INACTIVE   = "#1F2937";
const PLUS_CLR        = "#6B7280";

export interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPressPlus?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  onPressPlus,
  disabled = false,
  placeholder = "Talk to Apex…",
}: ChatInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  // Animate send button scale on press
  const sendScale = useRef(new Animated.Value(1)).current;

  const animateSend = () => {
    Animated.sequence([
      Animated.spring(sendScale, { toValue: 0.88, useNativeDriver: true, speed: 40 }),
      Animated.spring(sendScale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();
    onSend();
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <View style={styles.wrapper}>
      {/* Glass-like pill container */}
      <View
        style={[
          styles.container,
          { borderColor: focused ? BORDER_FOCUSED : BORDER_DEFAULT },
        ]}
      >
        {/* + Button */}
        <Pressable
          onPress={onPressPlus}
          style={({ pressed }) => [
            styles.plusBtn,
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={8}
        >
          <Feather name="plus" size={18} color={PLUS_CLR} />
        </Pressable>

        {/* Text input */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={PLACEHOLDER_CLR}
          style={styles.input}
          multiline
          maxLength={4000}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="default"
          blurOnSubmit={false}
          selectionColor="#2563EB"
          autoFocus={Platform.OS !== "web"}
        />

        {/* Send button */}
        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <Pressable
            onPress={animateSend}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              { backgroundColor: canSend ? SEND_ACTIVE : SEND_INACTIVE },
            ]}
          >
            <Feather
              name="arrow-up"
              size={17}
              color={canSend ? "#FFFFFF" : "#6B7280"}
              strokeWidth={2.5}
            />
          </Pressable>
        </Animated.View>
      </View>

      {/* Bottom hint */}
      <View style={styles.hint}>
        {/* Intentionally empty — could show char count or disclaimer */}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: BACKGROUND,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: CONTAINER_BG,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 6,
  },
  plusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    color: TEXT_COLOR,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 130,
    paddingTop: Platform.OS === "ios" ? 6 : 4,
    paddingBottom: Platform.OS === "ios" ? 6 : 4,
    paddingHorizontal: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  hint: {
    height: 4,
  },
});
