/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  FloatingVoiceButton                                         ║
 * ║  Drop-in floating voice orb for any page                    ║
 * ║  Combines VoiceOrb + VoiceConversationPanel with the hook   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useState, useCallback } from "react";
import { VoiceOrb } from "./VoiceOrb";
import { VoiceConversationPanel } from "./VoiceConversationPanel";
import {
  useVoiceConversation,
  type VoiceMode,
  type IntentResult,
} from "@/hooks/useVoiceConversation";

export interface FloatingVoiceButtonProps {
  /** Starting mode */
  initialMode?:     VoiceMode;
  /** Contextual info shown to AI (active project name, file, etc.) */
  projectContext?:  string;
  /** Called when user says a builder command */
  onBuilderCommand?: (action: string, params: Record<string, string>) => void;
  /** Called when user says a game action */
  onGameAction?:    (action: string, params: Record<string, string>) => void;
  /** Called when user says a navigation command */
  onNavigation?:    (destination: string) => void;
  /** Called with every classified intent */
  onIntentDetected?: (intent: IntentResult, text: string) => void;
  /** Position override (defaults to bottom-right above nav) */
  style?:           React.CSSProperties;
}

export function FloatingVoiceButton({
  initialMode     = "chat",
  projectContext  = "",
  onBuilderCommand,
  onGameAction,
  onNavigation,
  onIntentDetected,
  style,
}: FloatingVoiceButtonProps) {
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);

  const voice = useVoiceConversation({
    initialMode,
    pushToTalk,
    projectContext,
    onBuilderCommand,
    onGameAction,
    onNavigation,
    onIntentDetected,
  });

  const openPanel  = useCallback(() => setPanelOpen(true),  []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const togglePtt  = useCallback(() => setPushToTalk((p) => !p), []);

  if (!voice.isSupported) return null;

  return (
    <>
      {/* ── Floating orb (always visible) ──────────────────────────────── */}
      <div style={{
        position:  "fixed",
        right:     18,
        bottom:    88,
        zIndex:    500,
        ...style,
      }}>
        <VoiceOrb
          state={voice.state}
          mode={voice.mode}
          amplitude={voice.amplitude}
          interimText={voice.interimText}
          transcript={voice.transcript}
          isSupported={voice.isSupported}
          pushToTalk={pushToTalk}
          onToggle={voice.toggleListening}
          onPttStart={voice.pttStart}
          onPttEnd={voice.pttEnd}
          onInterrupt={voice.interrupt}
          onModeChange={voice.setMode}
          onOpenPanel={openPanel}
          size={52}
        />
      </div>

      {/* ── Full conversation panel (slide-up) ─────────────────────────── */}
      <VoiceConversationPanel
        open={panelOpen}
        state={voice.state}
        mode={voice.mode}
        amplitude={voice.amplitude}
        interimText={voice.interimText}
        transcript={voice.transcript}
        history={voice.history}
        lastIntent={voice.lastIntent}
        isSupported={voice.isSupported}
        pushToTalk={pushToTalk}
        projectContext={projectContext}
        onClose={closePanel}
        onToggleListening={voice.toggleListening}
        onPttStart={voice.pttStart}
        onPttEnd={voice.pttEnd}
        onInterrupt={voice.interrupt}
        onModeChange={voice.setMode}
        onClearHistory={voice.clearHistory}
        onTogglePtt={togglePtt}
      />
    </>
  );
}
