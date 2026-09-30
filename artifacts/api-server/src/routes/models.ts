/**
 * AI model directory and character voices.
 *
 *   GET  /models                 — every model, grouped by category, with whether it's connected
 *   GET  /voices/characters      — ElevenLabs voices suited to game characters
 *   POST /voices/preview         — hear a character line in a voice (signed in; ElevenLabs)
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { MODEL_CATALOG, CATEGORY_LABELS, isConnected } from "../lib/modelCatalog";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { getUserSecret } from "../lib/connectors";
import { canSpend, creditUserFor, outOfCredits, recordUsage, creditCost } from "../lib/credits";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/models", (_req, res): void => {
  res.json({
    ok: true,
    data: {
      categories: CATEGORY_LABELS,
      models: MODEL_CATALOG.map((m) => ({ ...m, connected: isConnected(m) })),
    },
  });
});

/** ElevenLabs premade voices, described the way a game developer would pick them. */
export const CHARACTER_VOICES = [
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", style: "Deep, confident hero" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", style: "Young, upbeat adventurer" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", style: "Gruff soldier or bouncer" },
  { id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde", style: "Battle-worn veteran" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", style: "Raspy, mysterious rogue" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", style: "Smooth, friendly guide" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", style: "Laid-back sidekick" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", style: "Calm narrator" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", style: "Warm, kind ally" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", style: "Fierce, determined fighter" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", style: "Bright, young character" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", style: "Cunning, elegant villain" },
  { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", style: "Gentle storyteller" },
  { id: "jBpfuIE2acCO8z3wKNLl", name: "Gigi", style: "Energetic, playful" },
] as const;

router.get("/voices/characters", (_req, res): void => {
  res.json({ ok: true, data: { voices: CHARACTER_VOICES, connected: !!process.env.ELEVENLABS_API_KEY } });
});

const PreviewBody = z.object({
  voiceId: z.string().regex(/^[A-Za-z0-9]{10,40}$/),
  text: z.string().min(1).max(300),
});

router.post("/voices/preview", requireUser, async (req: ApexRequest, res): Promise<void> => {
  // The person's own ElevenLabs account (Connectors) first, then the app's key
  const ownKey = await getUserSecret(req.userId!, "elevenlabs");
  const key = ownKey ?? process.env.ELEVENLABS_API_KEY;
  if (!key) {
    res.status(503).json({ ok: false, error: "ElevenLabs isn't connected yet. Link your ElevenLabs account in Connectors, or the owner can add ELEVENLABS_API_KEY." });
    return;
  }
  const parsed = PreviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Pick a voice and write a line (up to 300 characters)." });
    return;
  }
  const who = await creditUserFor(req.userId!);
  if (!who) { res.status(401).json({ ok: false, error: "Please sign in." }); return; }
  if (!ownKey) {
    const check = await canSpend(who, creditCost("elevenlabs"));
    if (!check.ok) { res.status(429).json(outOfCredits(check.balance, creditCost("elevenlabs"))); return; }
  }
  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${parsed.data.voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: parsed.data.text, model_id: "eleven_turbo_v2_5" }),
    });
    if (!upstream.ok) {
      logger.warn({ status: upstream.status }, "ElevenLabs preview failed");
      res.status(502).json({ ok: false, error: `ElevenLabs couldn't make that voice line (${upstream.status}).` });
      return;
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    await recordUsage(who, { provider: "elevenlabs", ownKey: !!ownKey, outputTokens: parsed.data.text.length }).catch(() => undefined);
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": String(audio.byteLength), "Cache-Control": "private, max-age=300" });
    res.send(audio);
  } catch (err) {
    logger.error({ err }, "ElevenLabs preview error");
    res.status(502).json({ ok: false, error: "Couldn't reach ElevenLabs. Try again." });
  }
});

export default router;
