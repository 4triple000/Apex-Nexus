/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX VOICE CONVERSATION API                             ║
 * ║  POST /api/voice/intent   — classify + route input      ║
 * ║  POST /api/voice/respond  — generate AI voice reply     ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// ── Intent categories ─────────────────────────────────────────────────────────

export type VoiceIntent =
  | "builder_command"
  | "game_action"
  | "ai_assistance"
  | "general_conversation"
  | "system_navigation"
  | "code_execution";

export type VoiceMode = "builder" | "game" | "chat" | "command";

export interface IntentResult {
  intent:     VoiceIntent;
  mode:       VoiceMode;
  confidence: number;
  action?:    string;
  params?:    Record<string, string>;
  reasoning?: string;
}

// ── POST /api/voice/intent ────────────────────────────────────────────────────

router.post("/api/voice/intent", async (req, res): Promise<void> => {
  const { text, currentMode, context } = req.body as {
    text:         string;
    currentMode?: VoiceMode;
    context?:     string;
  };

  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const systemPrompt = `You are Apex's intent detection engine. Classify the user's voice input into exactly one of these intents and modes.

INTENTS:
- builder_command: creating, modifying, or running code (e.g. "add recoil system", "generate a login form", "fix the bug")
- game_action: controlling or modifying a game (e.g. "jump higher", "spawn an enemy", "reset the level")
- ai_assistance: asking for AI help, knowledge, or analysis (e.g. "what's the best approach", "explain this algorithm")
- general_conversation: casual chat, greetings, opinions (e.g. "how are you", "that's cool", "thanks")
- system_navigation: navigating the app (e.g. "go to settings", "open the feed", "switch to game mode")
- code_execution: running or testing code (e.g. "run this", "test it", "execute")

MODES:
- builder: development / coding context
- game: in-game or game modification context
- chat: conversational AI context
- command: fast single-action execution

Current mode context: ${currentMode ?? "chat"}
${context ? `Session context: ${context}` : ""}

Respond with a JSON object ONLY, no markdown. Example:
{"intent":"builder_command","mode":"builder","confidence":0.92,"action":"add_feature","params":{"feature":"recoil system"},"reasoning":"User wants to add recoil to the FPS engine"}`;

  try {
    const completion = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      max_tokens:  200,
      temperature: 0.1,
      messages: [
        { role: "system",  content: systemPrompt },
        { role: "user",    content: `Classify this voice input: "${text}"` },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: IntentResult;

    try {
      result = JSON.parse(raw);
    } catch {
      result = {
        intent:     "general_conversation",
        mode:       currentMode ?? "chat",
        confidence: 0.5,
        reasoning:  "Parse fallback",
      };
    }

    res.json({ ok: true, result });
  } catch (err) {
    console.error("[voice/intent]", err);
    res.status(500).json({ error: "Intent detection failed" });
  }
});

// ── POST /api/voice/respond ───────────────────────────────────────────────────

router.post("/api/voice/respond", async (req, res): Promise<void> => {
  const { text, intent, mode, history, projectContext } = req.body as {
    text:            string;
    intent?:         IntentResult;
    mode?:           VoiceMode;
    history?:        Array<{ role: "user" | "assistant"; content: string }>;
    projectContext?: string;
  };

  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const emotionForMode: Record<VoiceMode, string> = {
    builder: "focused and precise — like a senior engineer pairing with you",
    game:    "energetic and quick — like a game co-pilot",
    chat:    "warm and conversational — like a knowledgeable friend",
    command: "concise and direct — like a fast command assistant",
  };

  const activeMode  = mode ?? "chat";
  const moodGuide   = emotionForMode[activeMode];
  const intentLabel = intent?.intent ?? "general_conversation";

  const systemPrompt = `You are Apex, an elite AI voice companion. Your personality is ${moodGuide}.

RULES:
- Keep responses SHORT (1-2 sentences max) — this is voice output
- Be natural, human, and conversational — no bullet points, no markdown
- Match the energy of the mode: ${activeMode}
- For builder_command intents: confirm the action with enthusiasm and brief detail
- For game_action: be quick and energetic
- For ai_assistance: give the core insight concisely
- For general_conversation: be warm and brief
- NEVER say "As an AI" or "I cannot" — just respond naturally
- End with an action or a single follow-up question when helpful

Current mode: ${activeMode}
User intent: ${intentLabel}
${projectContext ? `Active project: ${projectContext}` : ""}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...(history?.slice(-6) ?? []).map((m) => ({
      role:    m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: text },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      max_tokens:  120,
      temperature: 0.75,
      messages,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "Got it.";
    res.json({ ok: true, reply, mode: activeMode, intent: intentLabel });
  } catch (err) {
    console.error("[voice/respond]", err);
    res.status(500).json({ error: "Response generation failed" });
  }
});

export default router;
