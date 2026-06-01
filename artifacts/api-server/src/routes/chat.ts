import { Router, type IRouter } from "express";
import { SendChatBody, AnalyzeScreenshotBody } from "@workspace/api-zod";
import { chatSingle, chatBattle, chatHive } from "../lib/aiRouter";
import { incrementUsage } from "../lib/usageTracker";
import { openai } from "@workspace/integrations-openai-ai-server";
import { trackInteraction, getUserPersonalization } from "../lib/learningEngine";

const router: IRouter = Router();

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, mode, sessionId, preferredProvider } = parsed.data;
  const sid = sessionId ?? "anonymous";

  const usageResult = await incrementUsage(sid);
  if (usageResult.exceeded) {
    res.status(429).json({
      error: "Free tier limit reached. Upgrade to premium for more requests.",
      code: "USAGE_LIMIT_EXCEEDED",
    });
    return;
  }

  const usage = usageResult.usage!;
  const limit = usage.tier === "premium" ? 500 : 20;
  const remaining = Math.max(0, limit - usage.requestsUsed);

  if (mode === "battle") {
    const responses = await chatBattle(message);
    res.json({
      mode: "battle",
      messages: responses,
      routedTo: "openai,claude,perplexity",
      usageRemaining: remaining,
    });
    return;
  }

  if (mode === "hive") {
    const { responses, combined } = await chatHive(message);
    res.json({
      mode: "hive",
      messages: responses,
      routedTo: "openai,claude,perplexity",
      combinedAnswer: combined,
      usageRemaining: remaining,
    });
    return;
  }

  // Inject personalization if available
  const personalization = await getUserPersonalization(sid).catch(() => null);
  const personalizationHint = personalization?.systemPromptAddition;

  const responses = await chatSingle(message, preferredProvider ?? undefined, personalizationHint);
  const routedTo = responses[0]?.provider ?? "openai";
  const aiOutput = responses[0]?.content ?? "";
  const responseTimeMs = responses[0]?.responseTime;

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
    usageRemaining: remaining,
    personalizationActive: !!personalizationHint,
    preferredTone: personalization?.preferredTone,
  });
});

router.post("/chat/analyze-screenshot", async (req, res): Promise<void> => {
  const { content, context, imageBase64 } = req.body as {
    content?: string;
    context?: string;
    imageBase64?: string;
  };

  if (!content && !imageBase64) {
    res.status(400).json({ error: "Provide either content text or an image." });
    return;
  }

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
