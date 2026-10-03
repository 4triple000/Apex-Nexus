import { Router, type IRouter } from "express";
import { SendChatBody, AnalyzeScreenshotBody } from "@workspace/api-zod";
import { chatSingleWithHistory, chatBattle, chatHive, providerStatus, pickProvider, battleProviders, hasOwnKey, type AiResponse } from "../lib/aiRouter";
import { creditUserForSession, creditUserFor, canSpend, outOfCredits, recordUsage, getBalance, creditCost } from "../lib/credits";
import { getUserKeys, appContextFor } from "../lib/connectors";
import { requireUser, optionalAuth } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { openai } from "@workspace/integrations-openai-ai-server";
import { trackInteraction, getUserPersonalization } from "../lib/learningEngine";
import { freeLeftFor, freePoolStatus } from "../lib/freeModels";
import { db, mobileConversationsTable, mobileMessagesTable } from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

// Which AI models are connected, so the app can mark the others as "not connected"
router.get("/chat/providers", (_req, res): void => {
  res.json({ providers: providerStatus() });
});

// Every free model and what's left of its daily allowance (plus this person's own free messages when signed in)
router.get("/chat/free-models", optionalAuth, async (req: ApexRequest, res): Promise<void> => {
  const pool = await freePoolStatus();
  const who = await signedInUser(req);
  res.json({ ok: true, data: { ...pool, yourFreeLeft: who ? await freeLeftFor(who.userId, who.isOwner) : null } });
});

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, mode, sessionId, preferredProvider, conversationId: askedConversation, rawMessage } = parsed.data;
  const sid = sessionId ?? "";

  // AI costs real money, so chat needs an account (the session ID sent here is the signed-in one)
  const who = await creditUserForSession(sid);
  if (!who) {
    res.status(401).json({ error: "Please sign in to chat with Apex.", code: "SIGN_IN_REQUIRED" });
    return;
  }
  const keys = await getUserKeys(who.userId);

  // Check the person can afford this before asking any model
  const multi = mode === "battle" || mode === "hive";
  const providers = multi ? battleProviders(keys) : [pickProvider(message, preferredProvider ?? undefined, keys)];
  const needed = providers.reduce((sum, p) => sum + (hasOwnKey(keys, p) ? 0 : creditCost(p)), 0);
  const check = await canSpend(who, needed);
  if (!check.ok) {
    res.status(429).json(outOfCredits(check.balance, needed));
    return;
  }
  // Apex Free costs no credits, but each person has a daily number of free messages
  if (providers.includes("free") && (await freeLeftFor(who.userId, who.isOwner)) === 0) {
    res.status(429).json({ error: "You've used today's free messages. They come back at midnight UTC, or pick another model.", code: "FREE_LIMIT" });
    return;
  }

  const charge = async (responses: AiResponse[]) => {
    for (const r of responses) {
      if (r.error || !r.content || r.provider === "hive") continue;
      await recordUsage(who, { provider: r.provider, ownKey: r.ownKey, inputTokens: r.inputTokens, outputTokens: r.outputTokens }).catch(() => undefined);
    }
    return getBalance(who);
  };

  if (mode === "battle") {
    const responses = await chatBattle(message, keys);
    const credits = await charge(responses);
    res.json({ mode: "battle", messages: responses, routedTo: providers.join(","), usageRemaining: credits.remaining, credits });
    return;
  }

  if (mode === "hive") {
    const { responses, combined } = await chatHive(message, keys);
    const credits = await charge(responses);
    res.json({ mode: "hive", messages: responses, routedTo: providers.join(","), combinedAnswer: combined, usageRemaining: credits.remaining, credits });
    return;
  }

  // Personalization, plus data from linked apps when the message asks for it
  const [personalization, appContext] = await Promise.all([
    getUserPersonalization(sid).catch(() => null),
    appContextFor(who.userId, message).catch(() => ""),
  ]);
  const personalizationHint = [personalization?.systemPromptAddition, appContext].filter(Boolean).join("\n") || undefined;

  // A saved conversation: the model sees its recent turns, and this exchange is added to it
  const conversation = askedConversation ? await ownConversation(who.userId, askedConversation) : null;
  const history = conversation ? await recentTurns(conversation.id) : [];
  const responses = await chatSingleWithHistory(message, preferredProvider ?? undefined, personalizationHint, keys, history);
  const reply = responses[0];
  let conversationId: number | null = conversation?.id ?? null;
  if (reply && !reply.error && reply.content) {
    conversationId = await saveExchange(who.userId, conversationId, rawMessage?.trim() || message, reply).catch(() => conversationId);
  }
  const routedTo = responses[0]?.provider ?? "openai";
  const aiOutput = responses[0]?.content ?? "";
  const responseTimeMs = responses[0]?.responseTime;
  const credits = await charge(responses);

  // Auto-track the interaction (fire and forget)
  trackInteraction({
    sessionId: sid,
    interactionType: "chat",
    context: message,
    aiOutput,
    provider: routedTo,
    responseTimeMs,
    wasAccepted: true, // User triggered → assume accepted for now
    metadata: { mode: "chat" },
  }).catch(() => undefined);

  res.json({
    mode: "chat",
    messages: responses,
    routedTo,
    usageRemaining: credits.remaining,
    credits,
    conversationId,
    personalizationActive: !!personalization?.systemPromptAddition,
    preferredTone: personalization?.preferredTone,
  });
});

// ── Saved conversations ───────────────────────────────────────────────────────

async function ownConversation(userId: number, id: number) {
  const [conv] = await db.select().from(mobileConversationsTable)
    .where(and(eq(mobileConversationsTable.id, id), eq(mobileConversationsTable.userId, userId))).limit(1);
  return conv ?? null;
}

/** The last 12 messages, oldest first, for the model to remember. */
async function recentTurns(conversationId: number) {
  const rows = await db.select({ role: mobileMessagesTable.role, content: mobileMessagesTable.content }).from(mobileMessagesTable)
    .where(eq(mobileMessagesTable.conversationId, conversationId)).orderBy(desc(mobileMessagesTable.id)).limit(12);
  return rows.reverse().map((r) => ({ role: r.role === "assistant" ? "assistant" as const : "user" as const, content: r.content }));
}

/** Store one question and answer, starting a conversation (titled from the first message) when needed. */
async function saveExchange(userId: number, conversationId: number | null, message: string, reply: AiResponse): Promise<number> {
  let id = conversationId;
  if (!id) {
    const title = message.replace(/\s+/g, " ").trim().slice(0, 60) + (message.length > 60 ? "…" : "");
    const [conv] = await db.insert(mobileConversationsTable).values({ userId, title: title || "New chat" }).returning({ id: mobileConversationsTable.id });
    id = conv!.id;
  }
  await db.insert(mobileMessagesTable).values([
    { conversationId: id, role: "user", content: message },
    { conversationId: id, role: "assistant", content: reply.content, provider: reply.provider, model: reply.model ?? null },
  ]);
  await db.update(mobileConversationsTable).set({ updatedAt: new Date() }).where(eq(mobileConversationsTable.id, id));
  return id;
}

/** The signed-in person (any of the app's sign-in headers), or null. */
async function signedInUser(req: ApexRequest) {
  return req.userId ? creditUserFor(req.userId).catch(() => null) : null;
}

/** Your conversations, newest first, with the start of the last message. */
router.get("/chat/conversations", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const who = await signedInUser(req);
  if (!who) { res.status(401).json({ ok: false, error: "Please sign in." }); return; }
  const convs = await db.select().from(mobileConversationsTable)
    .where(eq(mobileConversationsTable.userId, who.userId)).orderBy(desc(mobileConversationsTable.updatedAt)).limit(100);
  const ids = convs.map((c) => c.id);
  const last = ids.length
    ? await db.selectDistinctOn([mobileMessagesTable.conversationId], { conversationId: mobileMessagesTable.conversationId, content: mobileMessagesTable.content })
        .from(mobileMessagesTable).where(inArray(mobileMessagesTable.conversationId, ids))
        .orderBy(mobileMessagesTable.conversationId, desc(mobileMessagesTable.id))
    : [];
  const preview = new Map(last.map((m) => [m.conversationId, m.content]));
  res.json({ ok: true, data: { conversations: convs.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, preview: (preview.get(c.id) ?? "").slice(0, 120) })) } });
});

/** One conversation's messages, oldest first. */
router.get("/chat/conversations/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const who = await signedInUser(req);
  if (!who) { res.status(401).json({ ok: false, error: "Please sign in." }); return; }
  const conv = await ownConversation(who.userId, Number(req.params.id));
  if (!conv) { res.status(404).json({ ok: false, error: "Conversation not found." }); return; }
  const messages = await db.select().from(mobileMessagesTable)
    .where(eq(mobileMessagesTable.conversationId, conv.id)).orderBy(asc(mobileMessagesTable.id)).limit(500);
  res.json({ ok: true, data: { conversation: { id: conv.id, title: conv.title, updatedAt: conv.updatedAt }, messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, provider: m.provider, model: m.model, createdAt: m.createdAt })) } });
});

router.patch("/chat/conversations/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const who = await signedInUser(req);
  if (!who) { res.status(401).json({ ok: false, error: "Please sign in." }); return; }
  const title = String((req.body as { title?: unknown })?.title ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const conv = await ownConversation(who.userId, Number(req.params.id));
  if (!conv || !title) { res.status(conv ? 400 : 404).json({ ok: false, error: conv ? "Give it a name." : "Conversation not found." }); return; }
  await db.update(mobileConversationsTable).set({ title }).where(eq(mobileConversationsTable.id, conv.id));
  res.json({ ok: true, data: { id: conv.id, title } });
});

router.delete("/chat/conversations/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const who = await signedInUser(req);
  if (!who) { res.status(401).json({ ok: false, error: "Please sign in." }); return; }
  const conv = await ownConversation(who.userId, Number(req.params.id));
  if (!conv) { res.status(404).json({ ok: false, error: "Conversation not found." }); return; }
  await db.delete(mobileConversationsTable).where(eq(mobileConversationsTable.id, conv.id));
  res.json({ ok: true, data: { deleted: true } });
});

router.post("/chat/analyze-screenshot", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const { content, context, imageBase64 } = req.body as {
    content?: string;
    context?: string;
    imageBase64?: string;
  };

  if (!content && !imageBase64) {
    res.status(400).json({ error: "Provide either content text or an image." });
    return;
  }
  const who = await creditUserFor(req.userId!);
  if (!who) { res.status(401).json({ error: "Please sign in." }); return; }
  const check = await canSpend(who, creditCost("openai"));
  if (!check.ok) { res.status(429).json(outOfCredits(check.balance, creditCost("openai"))); return; }

  const systemPrompt = `You are an expert conversation analyst. Analyze the conversation or screenshot and provide:
1. A brief analysis of the situation/content
2. Three different suggested reply options

${context ? `Context: ${context}\n\n` : ""}Respond ONLY in valid JSON format:
{
  "analysis": "Brief analysis of what's happening",
  "suggestions": ["Reply option 1", "Reply option 2", "Reply option 3"]
}`;

  try {
    let messages: any[];

    if (imageBase64) {
      const dataUrl = imageBase64.startsWith("data:") 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64}`;

      messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: systemPrompt + (content ? `\n\nAdditional context from user: ${content}` : "\n\nAnalyze this screenshot."),
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ];
    } else {
      messages = [
        {
          role: "user",
          content: `${systemPrompt}\n\nConversation content:\n${content}`,
        },
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages,
    });

    await recordUsage(who, { provider: "openai", inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens }).catch(() => undefined);
    const rawContent = response.choices[0]?.message?.content ?? "{}";

    let parsed2: { analysis: string; suggestions: string[] };
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed2 = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed2 = {
        analysis: rawContent,
        suggestions: ["I see.", "That's interesting.", "Can you tell me more?"],
      };
    }

    res.json({
      analysis: parsed2.analysis ?? "Unable to analyze",
      suggestions: parsed2.suggestions ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to analyze screenshot");
    res.status(500).json({ error: "Failed to analyze conversation" });
  }
});

export default router;
