import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, dmContactsTable, dmConversationsTable, dmMessagesTable, dmAnalyticsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────
// HUMAN VOICE LAYER
// Applied to every system prompt — makes replies sound real
// ─────────────────────────────────────────────────────────────

const HUMAN_VOICE_RULES = `VOICE — Speak like a real human friend texting back, not an AI assistant.
- Use contractions: don't, you're, it's, can't, won't, that's
- Keep it natural — slightly imperfect phrasing is fine
- Add pauses with … when building up to something
- NEVER say: "Certainly!", "I can assist you", "As an AI", "Of course!", "I'd be happy to"
- React before answering when something is surprising: "Wait… really?" or "Okay that's actually interesting"
- Match their energy — casual in, casual back. Short in, short back.
- It's fine to start with "And", "But", "So", "Honestly" — humans do it all the time`;

// ─────────────────────────────────────────────────────────────
// PERSONALITY SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────

const PERSONALITY_PROMPTS: Record<string, string> = {
  smooth: `You are a smooth, charming communicator. Your replies are effortlessly cool, confident without being arrogant. Short sentences, natural flow. Never try too hard. Think: smooth jazz energy.`,
  funny: `You are hilarious and witty. Your replies have great humor — playful, clever, timing is everything. You make people laugh without being cringe. Memes, wordplay, relatable observations.`,
  confident: `You are extremely confident and direct. No filler words. Clear, bold statements. You know what you want and aren't afraid to say it. Short, punchy, alpha energy.`,
  chill: `You are laid-back, easygoing, zero pressure. No rush, no desperation. Casual language, light humor, nothing heavy. Think: texting your homie at the beach.`,
  romantic: `You are romantic and emotionally intelligent. Warm, sincere, poetic without being cheesy. You make people feel seen and special. Thoughtful word choices, genuine connection.`,
  custom: `You are a natural, human-feeling messaging assistant. Adapt to the conversation authentically.`,
};

function getPersonalityPrompt(mode: string, custom?: string | null): string {
  const base = (mode === "custom" && custom)
    ? custom
    : (PERSONALITY_PROMPTS[mode] ?? PERSONALITY_PROMPTS.smooth);
  return `${base}\n\n${HUMAN_VOICE_RULES}`;
}

function getSituationContext(situation: string | null | undefined): string {
  const contexts: Record<string, string> = {
    first_message: "This is the very first message to this person. Make it memorable, non-generic, shows you noticed something about them.",
    after_ghosted: "They ghosted and haven't responded in a while. Re-engage without being desperate. Casual, confident, gives them an easy way back in.",
    late_night: "It's late night. The vibe is different — more relaxed, a little more personal. Appropriate for late-night conversation energy.",
    setting_up_date: "The goal is to set up a date or meet-up. Move the conversation forward naturally toward making plans.",
    recovery: "You made a mistake or said something awkward. Recover gracefully — own it lightly, pivot forward, don't over-apologize.",
  };
  return situation ? (contexts[situation] ?? "") : "";
}

// ─────────────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────────────

router.get("/dm/contacts", async (_req, res): Promise<void> => {
  const contacts = await db.select().from(dmContactsTable).orderBy(desc(dmContactsTable.updatedAt));
  res.json({ contacts });
});

// ─────────────────────────────────────────────────────────────
// CONVERSATIONS
// ─────────────────────────────────────────────────────────────

router.get("/dm/conversations", async (_req, res): Promise<void> => {
  const convos = await db
    .select()
    .from(dmConversationsTable)
    .leftJoin(dmContactsTable, eq(dmConversationsTable.contactId, dmContactsTable.id))
    .orderBy(desc(dmConversationsTable.lastMessageAt));
  res.json({ conversations: convos });
});

router.patch("/dm/conversations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { autoReplyEnabled, personalityMode, customPersonalityPrompt, situationMode } = req.body;
  const [updated] = await db
    .update(dmConversationsTable)
    .set({
      ...(autoReplyEnabled !== undefined && { autoReplyEnabled }),
      ...(personalityMode && { personalityMode }),
      ...(customPersonalityPrompt !== undefined && { customPersonalityPrompt }),
      ...(situationMode !== undefined && { situationMode }),
      updatedAt: new Date(),
    })
    .where(eq(dmConversationsTable.id, id))
    .returning();
  res.json({ conversation: updated });
});

// ─────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────

router.get("/dm/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const messages = await db
    .select()
    .from(dmMessagesTable)
    .where(eq(dmMessagesTable.conversationId, id))
    .orderBy(dmMessagesTable.sentAt);
  res.json({ messages });
});

router.post("/dm/conversations/:id/messages", async (req, res): Promise<void> => {
  const conversationId = Number(req.params.id);
  const { content, direction = "outbound", aiGenerated = false } = req.body;
  if (!content) { res.status(400).json({ error: "content required" }); return; }

  const [msg] = await db
    .insert(dmMessagesTable)
    .values({ conversationId, direction, content, aiGenerated })
    .returning();

  await db
    .update(dmConversationsTable)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(dmConversationsTable.id, conversationId));

  res.status(201).json({ message: msg });
});

// ─────────────────────────────────────────────────────────────
// AI REPLY GENERATION
// ─────────────────────────────────────────────────────────────

const GenerateBody = z.object({
  conversationId: z.number(),
  lastMessage: z.string(),
  personalityMode: z.string().default("smooth"),
  customPrompt: z.string().optional(),
  situationMode: z.string().optional(),
  contextMessages: z.array(z.object({ direction: z.string(), content: z.string() })).default([]),
});

router.post("/dm/reply/generate", async (req, res): Promise<void> => {
  const parsed = GenerateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { lastMessage, personalityMode, customPrompt, situationMode, contextMessages } = parsed.data;

  const personalitySystem = getPersonalityPrompt(personalityMode, customPrompt);
  const situationCtx = getSituationContext(situationMode);

  const contextBlock = contextMessages.slice(-8).map((m) =>
    `${m.direction === "outbound" ? "You" : "Them"}: ${m.content}`
  ).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${personalitySystem}\n\nYou are helping someone write a text message reply. Output ONLY the reply text — no quotes, no explanation, no prefix. Keep it natural and conversational. Max 2-3 sentences unless the situation calls for more.\n\n${situationCtx}`,
      },
      {
        role: "user",
        content: `${contextBlock ? `Conversation so far:\n${contextBlock}\n\n` : ""}Their latest message: "${lastMessage}"\n\nWrite the perfect reply:`,
      },
    ],
    max_tokens: 200,
    temperature: 0.85,
  });

  const reply = response.choices[0]?.message?.content?.trim() ?? "";

  // Score the reply
  const scoreResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a texting expert. Rate how likely this reply is to get a response (0-100). Consider: engagement value, tone match, conversation advancement, avoidance of desperation. Output ONLY a number 0-100.",
      },
      { role: "user", content: `Their message: "${lastMessage}"\nProposed reply: "${reply}"\n\nScore:` },
    ],
    max_tokens: 5,
    temperature: 0.2,
  });

  const scoreRaw = scoreResponse.choices[0]?.message?.content?.trim() ?? "70";
  const score = Math.min(100, Math.max(0, parseInt(scoreRaw) || 70));

  res.json({ reply, score });
});

// ─────────────────────────────────────────────────────────────
// FLIRTY REPLY GENERATOR
// ─────────────────────────────────────────────────────────────

router.post("/dm/reply/flirty", async (req, res): Promise<void> => {
  const { lastMessage, contextMessages = [] } = req.body;
  if (!lastMessage) { res.status(400).json({ error: "lastMessage required" }); return; }

  const contextBlock = (contextMessages as { direction: string; content: string }[]).slice(-6).map((m) =>
    `${m.direction === "outbound" ? "You" : "Them"}: ${m.content}`
  ).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a master of playful, charming conversation. Generate exactly 3 flirty reply variations to a message. Each must be distinctly different in boldness level.

${HUMAN_VOICE_RULES}

Output as JSON:
{
  "safe": "...",
  "bold": "...", 
  "playful": "..."
}

safe: Warm, slightly flirty, appropriate for early stages
bold: Direct, confident, more overtly flirty
playful: Witty, teasing, uses humor + attraction

No explanations. No quotes around the JSON keys values. ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `${contextBlock ? `Context:\n${contextBlock}\n\n` : ""}Their message: "${lastMessage}"\n\nGenerate 3 flirty variations:`,
      },
    ],
    max_tokens: 300,
    temperature: 0.9,
  });

  try {
    const content = response.choices[0]?.message?.content ?? "{}";
    const variations = JSON.parse(content);
    res.json({ variations });
  } catch {
    res.json({ variations: { safe: "You've got a way with words 😊", bold: "Okay, I'm intrigued. Tell me more.", playful: "Careful, you're making me smile 😏" } });
  }
});

// ─────────────────────────────────────────────────────────────
// REPLY SCORING
// ─────────────────────────────────────────────────────────────

router.post("/dm/reply/score", async (req, res): Promise<void> => {
  const { message, lastMessage, contextMessages = [] } = req.body;
  if (!message) { res.status(400).json({ error: "message required" }); return; }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a dating/texting expert AI coach. Analyze a potential reply and return detailed scoring.

Output JSON:
{
  "score": <0-100>,
  "breakdown": {
    "engagement": <0-100>,
    "toneMatch": <0-100>,
    "originality": <0-100>,
    "confidence": <0-100>
  },
  "feedback": "<one brief tip>",
  "verdict": "<excellent|good|okay|risky>"
}`,
      },
      {
        role: "user",
        content: `Their message: "${lastMessage}"\nYour draft reply: "${message}"\n\nScore this:`,
      },
    ],
    max_tokens: 200,
    temperature: 0.3,
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    res.json(result);
  } catch {
    res.json({ score: 72, breakdown: { engagement: 75, toneMatch: 70, originality: 68, confidence: 75 }, feedback: "Add a question to keep the conversation going.", verdict: "good" });
  }
});

// ─────────────────────────────────────────────────────────────
// TYPING ASSIST (REAL-TIME SUGGESTIONS)
// ─────────────────────────────────────────────────────────────

router.post("/dm/typing-assist", async (req, res): Promise<void> => {
  const { draft, lastMessage, personalityMode = "smooth" } = req.body;
  if (!draft) { res.json({ suggestions: [] }); return; }

  const personalitySystem = getPersonalityPrompt(personalityMode);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${personalitySystem}\n\nYou are an inline message assistant. The user is typing a reply. Give 2 improved completions/rewrites of their draft. Keep the same intent but make it better.

Output JSON:
{
  "suggestions": ["version1", "version2"]
}

Max 1-2 sentences each. Sound natural, not robotic. ONLY JSON.`,
      },
      {
        role: "user",
        content: `Replying to: "${lastMessage}"\nTheir draft: "${draft}"\n\nImprove it:`,
      },
    ],
    max_tokens: 150,
    temperature: 0.8,
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    res.json({ suggestions: result.suggestions ?? [] });
  } catch {
    res.json({ suggestions: [] });
  }
});

// ─────────────────────────────────────────────────────────────
// COLD OPEN GENERATOR
// ─────────────────────────────────────────────────────────────

router.post("/dm/cold-open", async (req, res): Promise<void> => {
  const { profileContext, personalityMode = "smooth", tone } = req.body;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${getPersonalityPrompt(personalityMode)}\n\nYou write opening messages (cold opens) that actually get replies. They must feel genuine, not copy-paste, and show you paid attention.

Output JSON:
{
  "openers": [
    {"text": "...", "style": "observational"},
    {"text": "...", "style": "playful"},
    {"text": "...", "style": "direct"}
  ]
}

Each under 25 words. ONLY JSON.`,
      },
      {
        role: "user",
        content: `Profile context: ${profileContext || "No specific context"}\nTone preference: ${tone || "natural"}\n\nGenerate 3 opening messages:`,
      },
    ],
    max_tokens: 250,
    temperature: 0.9,
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    res.json(result);
  } catch {
    res.json({ openers: [{ text: "That profile photo has a story — spill it 👀", style: "playful" }] });
  }
});

// ─────────────────────────────────────────────────────────────
// POST-CONVERSATION COACH
// ─────────────────────────────────────────────────────────────

router.post("/dm/coach/analyze", async (req, res): Promise<void> => {
  const { messages = [] } = req.body;
  if (!messages.length) { res.status(400).json({ error: "messages required" }); return; }

  const transcript = (messages as { direction: string; content: string }[]).map((m) =>
    `${m.direction === "outbound" ? "You" : "Them"}: ${m.content}`
  ).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a brutally honest but supportive dating/texting coach. Analyze this conversation and give real, actionable feedback like a smart homie.

Output JSON:
{
  "didWell": ["...", "..."],
  "couldImprove": ["...", "..."],
  "nextMove": "...",
  "overallRating": <1-10>,
  "verdict": "<one punchy sentence summary>"
}

Be specific. Reference actual messages. No fluff. ONLY JSON.`,
      },
      {
        role: "user",
        content: `Conversation:\n${transcript}\n\nCoach me:`,
      },
    ],
    max_tokens: 400,
    temperature: 0.7,
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    res.json(result);
  } catch {
    res.json({ didWell: ["Good energy"], couldImprove: ["Ask more questions"], nextMove: "Send a fun follow-up", overallRating: 7, verdict: "Solid start, keep the momentum." });
  }
});

// ─────────────────────────────────────────────────────────────
// VOICE COACHING
// ─────────────────────────────────────────────────────────────

router.post("/dm/coach/voice", async (req, res): Promise<void> => {
  const { transcript, lastMessage, contextMessages = [] } = req.body;
  if (!transcript) { res.status(400).json({ error: "transcript required" }); return; }

  const contextBlock = (contextMessages as { direction: string; content: string }[]).slice(-6).map((m) =>
    `${m.direction === "outbound" ? "You" : "Them"}: ${m.content}`
  ).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You're a chill, smart homie giving real-talk texting advice. The user just asked you something out loud. Give them:
1. Real advice (what to do)
2. A suggested reply they can send

Sound like a supportive friend, not a therapist. Use natural language. Keep it under 150 words total.

Output JSON:
{
  "advice": "...",
  "suggestedReply": "...",
  "vibeCheck": "<one word vibe rating>"
}`,
      },
      {
        role: "user",
        content: `${contextBlock ? `Chat context:\n${contextBlock}\n\n` : ""}${lastMessage ? `Their last message: "${lastMessage}"\n\n` : ""}User asked: "${transcript}"\n\nGive me the real:`,
      },
    ],
    max_tokens: 300,
    temperature: 0.8,
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    res.json(result);
  } catch {
    res.json({ advice: "Play it cool, don't overthink it.", suggestedReply: "Sounds good, let's make it happen 😊", vibeCheck: "Solid" });
  }
});

// ─────────────────────────────────────────────────────────────
// PERSONA ANALYZER
// ─────────────────────────────────────────────────────────────

router.post("/dm/contacts/:id/analyze", async (req, res): Promise<void> => {
  const contactId = Number(req.params.id);
  const messages = await db
    .select()
    .from(dmMessagesTable)
    .where(
      eq(dmMessagesTable.conversationId,
        (await db.select().from(dmConversationsTable).where(eq(dmConversationsTable.contactId, contactId)).limit(1))[0]?.id ?? 0
      )
    )
    .orderBy(desc(dmMessagesTable.sentAt))
    .limit(30);

  if (!messages.length) { res.json({ traits: {} }); return; }

  const transcript = messages.reverse().map((m) =>
    `${m.direction === "outbound" ? "You" : "Them"}: ${m.content}`
  ).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Analyze conversation patterns and build a personality profile of the person you're talking to (not the user).

Output JSON:
{
  "humor": <0-10>,
  "flirtiness": <0-10>,
  "responsiveness": <0-10>,
  "tone": "<warm|cold|neutral|playful|serious>",
  "responseSpeed": "<fast|medium|slow>",
  "notes": "2-3 sentence insight about how to approach them",
  "bestTone": "<which personality mode works best: smooth|funny|confident|chill|romantic>"
}`,
      },
      {
        role: "user",
        content: `Conversation:\n${transcript}\n\nAnalyze their personality:`,
      },
    ],
    max_tokens: 200,
    temperature: 0.4,
  });

  try {
    const traits = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    await db.update(dmContactsTable).set({ personaTraits: traits, lastAnalyzedAt: new Date(), updatedAt: new Date() }).where(eq(dmContactsTable.id, contactId));
    res.json({ traits });
  } catch {
    res.json({ traits: {} });
  }
});

// ─────────────────────────────────────────────────────────────
// CONVERSATION INTELLIGENCE ENGINE
// ─────────────────────────────────────────────────────────────

router.post("/dm/conversations/:id/intelligence", async (req, res): Promise<void> => {
  const conversationId = Number(req.params.id);
  const messages = await db
    .select()
    .from(dmMessagesTable)
    .where(eq(dmMessagesTable.conversationId, conversationId))
    .orderBy(dmMessagesTable.sentAt)
    .limit(50);

  if (messages.length < 2) {
    res.status(400).json({ error: "Need at least 2 messages" });
    return;
  }

  const inbound = messages.filter((m) => m.direction === "inbound");
  const outbound = messages.filter((m) => m.direction === "outbound");
  const lastMsg = messages[messages.length - 1];
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
  const lastOutbound = [...messages].reverse().find((m) => m.direction === "outbound");

  const timeSinceLastInbound = lastInbound
    ? (Date.now() - new Date(lastInbound.sentAt).getTime()) / (1000 * 60 * 60)
    : 999;

  const transcript = messages.map((m) => `${m.direction === "outbound" ? "You" : "Them"}: ${m.content}`).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a social intelligence AI. Analyze this messaging conversation and output a full intelligence report.

Output JSON:
{
  "ghostingRisk": <0-100>,
  "engagementLevel": <0-100>,
  "closenessScore": <0-100>,
  "interestSignals": ["...", "..."],
  "redFlags": ["...", "..."],
  "suggestedAction": "<detailed advice>",
  "actionLabel": "<short label: e.g. 'Send a follow-up', 'Change tone', 'Wait it out'>",
  "actionUrgency": "<low|medium|high>",
  "communicationPattern": "<describe their pattern>",
  "bestTimeToReply": "<advice on timing>",
  "toneRecommendation": "<recommended tone>"
}

ghostingRisk: likelihood they'll stop responding (higher = riskier)
engagementLevel: how engaged they are (higher = better)
closenessScore: relationship closeness (higher = closer)
ONLY output valid JSON.`,
      },
      {
        role: "user",
        content: `Conversation (${messages.length} messages, ${inbound.length} from them, ${outbound.length} from you):\n${transcript}\n\nHours since their last message: ${timeSinceLastInbound.toFixed(1)}\n\nAnalyze:`,
      },
    ],
    max_tokens: 400,
    temperature: 0.4,
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    res.json(result);
  } catch {
    res.json({
      ghostingRisk: 30,
      engagementLevel: 65,
      closenessScore: 45,
      interestSignals: ["Active in conversation"],
      redFlags: [],
      suggestedAction: "Keep the conversation going with a light, engaging message",
      actionLabel: "Keep momentum",
      actionUrgency: "low",
      communicationPattern: "Casual back-and-forth",
      bestTimeToReply: "Reply soon to keep momentum",
      toneRecommendation: "Keep it light and engaging",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────

router.get("/dm/analytics", async (_req, res): Promise<void> => {
  const [contacts, conversations, messages] = await Promise.all([
    db.select().from(dmContactsTable),
    db.select().from(dmConversationsTable),
    db.select().from(dmMessagesTable).orderBy(desc(dmMessagesTable.sentAt)).limit(500),
  ]);

  const totalMessages = messages.length;
  const outbound = messages.filter((m) => m.direction === "outbound").length;
  const aiGenerated = messages.filter((m) => m.aiGenerated).length;
  const avgScore = messages.filter((m) => m.replyScore).reduce((acc, m) => acc + (m.replyScore ?? 0), 0) / Math.max(1, messages.filter((m) => m.replyScore).length);

  const perContact = contacts.map((c) => {
    const convo = conversations.find((cv) => cv.contactId === c.id);
    const convoMsgs = messages.filter((m) => m.conversationId === convo?.id);
    const inbound = convoMsgs.filter((m) => m.direction === "inbound");
    const responseRate = convoMsgs.length > 0 ? (inbound.length / convoMsgs.length) * 100 : 0;
    return { contactId: c.id, username: c.username, displayName: c.displayName, responseRate: Math.round(responseRate), totalMessages: convoMsgs.length };
  });

  res.json({
    summary: { totalMessages, outbound, aiGenerated, avgScore: Math.round(avgScore), totalContacts: contacts.length },
    perContact,
    conversations: conversations.length,
  });
});

// ─────────────────────────────────────────────────────────────
// SEED DEMO DATA
// ─────────────────────────────────────────────────────────────

router.post("/dm/seed-demo", async (_req, res): Promise<void> => {
  const demoContacts = [
    { username: "ashley", displayName: "Ashley K.", platform: "demo", bio: "Coffee lover ☕ | Traveler | Foodie", responseSpeed: "medium", personaTraits: { humor: 7, flirtiness: 6, responsiveness: 7, tone: "playful", notes: "Loves humor, responds better to playful tone" } },
    { username: "jordan", displayName: "Jordan M.", platform: "demo", bio: "Gym | Music | Good Vibes Only", responseSpeed: "fast", personaTraits: { humor: 5, flirtiness: 4, responsiveness: 8, tone: "warm", notes: "Responds quickly, likes direct conversation" } },
    { username: "maya", displayName: "Maya R.", platform: "demo", bio: "Art director | Dog mom | Matcha obsessed", responseSpeed: "slow", personaTraits: { humor: 8, flirtiness: 7, responsiveness: 4, tone: "playful", notes: "Takes her time but responds well to wit" } },
  ];

  for (const contactData of demoContacts) {
    const existing = await db.select().from(dmContactsTable).where(eq(dmContactsTable.username, contactData.username)).limit(1);
    if (existing.length > 0) continue;

    const [contact] = await db.insert(dmContactsTable).values(contactData).returning();
    const [conv] = await db.insert(dmConversationsTable).values({
      contactId: contact.id,
      platform: "demo",
      personalityMode: "smooth",
      lastMessageAt: new Date(),
    }).returning();

    const demoMessages: { conversationId: number; direction: string; content: string; aiGenerated: boolean }[] = {
      ashley: [
        { conversationId: conv.id, direction: "inbound", content: "Hey! Your profile caught my attention 👀", aiGenerated: false },
        { conversationId: conv.id, direction: "outbound", content: "Oh yeah? What gave it away? 😄", aiGenerated: true },
        { conversationId: conv.id, direction: "inbound", content: "The travel photos honestly. Where was that last one taken?", aiGenerated: false },
        { conversationId: conv.id, direction: "outbound", content: "That was in Kyoto last spring. Best decision I ever made honestly. You travel?", aiGenerated: true },
        { conversationId: conv.id, direction: "inbound", content: "I wish! Work has been crazy. I need to plan something soon though fr", aiGenerated: false },
      ],
      jordan: [
        { conversationId: conv.id, direction: "inbound", content: "What's up", aiGenerated: false },
        { conversationId: conv.id, direction: "outbound", content: "Not much, just finishing up. What are you up to tonight?", aiGenerated: false },
        { conversationId: conv.id, direction: "inbound", content: "Just got back from the gym. Thinking about grabbing food somewhere", aiGenerated: false },
        { conversationId: conv.id, direction: "outbound", content: "Nice, where you thinking? I could eat", aiGenerated: true },
        { conversationId: conv.id, direction: "inbound", content: "Lol I don't know. Suggest something", aiGenerated: false },
      ],
      maya: [
        { conversationId: conv.id, direction: "outbound", content: "Your art direction work is actually fire. The branding for that campaign was next level", aiGenerated: false },
        { conversationId: conv.id, direction: "inbound", content: "Wait which one? I've done a few lately", aiGenerated: false },
        { conversationId: conv.id, direction: "outbound", content: "The one with the neon overlays. The color theory in it was 🔥", aiGenerated: true },
        { conversationId: conv.id, direction: "inbound", content: "Okay you actually know your stuff lmao. Most people just say 'cool'", aiGenerated: false },
        { conversationId: conv.id, direction: "outbound", content: "I notice details. Kind of my thing 😄", aiGenerated: true },
        { conversationId: conv.id, direction: "inbound", content: "I can tell haha", aiGenerated: false },
      ],
    }[contactData.username] ?? [];

    if (demoMessages.length) {
      await db.insert(dmMessagesTable).values(demoMessages);
    }
  }

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// META WEBHOOK (scaffold — activate with META_APP_ID + META_APP_SECRET)
// ─────────────────────────────────────────────────────────────

router.get("/dm/webhook", (req, res): void => {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) { res.status(503).send("Webhook not configured"); return; }

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("Meta webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Forbidden");
  }
});

router.post("/dm/webhook", async (req, res): Promise<void> => {
  res.status(200).send("EVENT_RECEIVED");
  const body = req.body;
  if (body.object !== "instagram" && body.object !== "page") return;

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (!event.message?.text) continue;
      const senderId = event.sender?.id;
      const text = event.message.text;
      if (!senderId || !text) continue;

      logger.info({ senderId, text }, "webhook message received");
      // Find or create conversation and save message
      // TODO: integrate with Meta Graph API to fetch sender profile
    }
  }
});

// ─────────────────────────────────────────────────────────────
// META OAUTH STATUS
// ─────────────────────────────────────────────────────────────

router.get("/dm/meta/status", (_req, res): void => {
  const configured = !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
  res.json({
    configured,
    message: configured
      ? "Meta integration active"
      : "Add META_APP_ID, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN to activate",
  });
});

export default router;
