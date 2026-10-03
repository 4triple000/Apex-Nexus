import { Router, type IRouter } from "express";
import { SendChatBody, AnalyzeScreenshotBody } from "@workspace/api-zod";
import { chatSingle, chatBattle, chatHive, providerStatus, pickProvider, battleProviders, hasOwnKey, type AiResponse } from "../lib/aiRouter";
import { creditUserForSession, creditUserFor, canSpend, outOfCredits, recordUsage, getBalance, creditCost } from "../lib/credits";
import { getUserKeys, appContextFor } from "../lib/connectors";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { openai } from "@workspace/integrations-openai-ai-server";
import { trackInteraction, getUserPersonalization } from "../lib/learningEngine";
import { freeLeftFor, freePoolStatus } from "../lib/freeModels";

const router: IRouter = Router();

// Which AI models are connected, so the app can mark the others as "not connected"
router.get("/chat/providers", (_req, res): void => {
  res.json({ providers: providerStatus() });
});

// Every free model and what's left of its daily allowance (plus this person's own free messages when signed in)
router.get("/chat/free-models", async (req, res): Promise<void> => {
  const pool = await freePoolStatus();
  const who = await creditUserForSession(String(req.headers["x-session-id"] ?? "")).catch(() => null);
  res.json({ ok: true, data: { ...pool, yourFreeLeft: who ? await freeLeftFor(who.userId, who.isOwner) : null } });
});

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, mode, sessionId, preferredProvider } = parsed.data;
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

  const responses = await chatSingle(message, preferredProvider ?? undefined, personalizationHint, keys);
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
    personalizationActive: !!personalization?.systemPromptAddition,
    preferredTone: personalization?.preferredTone,
  });
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
