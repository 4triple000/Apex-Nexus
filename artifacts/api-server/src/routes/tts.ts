/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  TTS PROXY — ElevenLabs voice generation                ║
 * ║  POST /api/tts/generate                                 ║
 * ║  GET  /api/tts/voices                                   ║
 * ║  GET  /api/tts/status                                   ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * The API key never leaves the server.  The frontend sends text + voiceId
 * and receives an audio/mpeg stream directly.
 */
import { Router, type IRouter } from "express";

const router: IRouter = Router();

const MAX_CHARS = 600;
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

/** ElevenLabs model — turbo v2.5 gives <400 ms first-byte latency */
const MODEL_ID = "eleven_turbo_v2_5";

// ── Apex voice registry (public ElevenLabs pre-built voices) ─────────────────

export const APEX_VOICES: Record<string, { id: string; label: string; tone: string }> = {
  strategist: { id: "pNInz6obpgDQGcFmaJgB", label: "Adam",    tone: "firm"      },
  friend:     { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella",   tone: "warm"      },
  mentor:     { id: "ThT5KcBeYPX3keUQqHPh", label: "Dorothy", tone: "clear"     },
  debater:    { id: "VR6AewLTigWG4xSOukaG", label: "Arnold",  tone: "intense"   },
  innovator:  { id: "jBpfuIE2acCO8z3wKNLl", label: "Gigi",    tone: "energetic" },
};

// ── GET /api/tts/status ───────────────────────────────────────────────────────

router.get("/api/tts/status", (_req, res) => {
  const configured = !!process.env.ELEVENLABS_API_KEY;
  res.json({ available: configured });
});

// ── GET /api/tts/voices ───────────────────────────────────────────────────────

router.get("/api/tts/voices", (_req, res) => {
  res.json({ voices: APEX_VOICES });
});

// ── POST /api/tts/generate ────────────────────────────────────────────────────

router.post("/api/tts/generate", async (req, res): Promise<void> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "ElevenLabs not configured" });
    return;
  }

  const {
    text,
    voiceId,
    stability        = 0.60,
    similarity_boost = 0.80,
    style            = 0.35,
    use_speaker_boost = true,
  } = req.body as {
    text: string;
    voiceId?: string;
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const cleaned = text
    .replace(/```[\s\S]*?```/g, "code block")
    .replace(/[*_~`>#]/g, "")
    .trim()
    .slice(0, MAX_CHARS);

  if (cleaned.length === 0) {
    res.status(400).json({ error: "text is empty after sanitisation" });
    return;
  }

  // Resolve voice — default to Strategist (Adam)
  const resolvedVoiceId = voiceId ?? APEX_VOICES.strategist.id;

  try {
    const upstream = await fetch(
      `${ELEVEN_BASE}/text-to-speech/${resolvedVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   apiKey,
          "Content-Type": "application/json",
          "Accept":       "audio/mpeg",
        },
        body: JSON.stringify({
          text: cleaned,
          model_id: MODEL_ID,
          voice_settings: {
            stability,
            similarity_boost,
            style,
            use_speaker_boost,
          },
        }),
      }
    );

    if (!upstream.ok) {
      const errBody = await upstream.text();
      console.error(`[TTS] ElevenLabs error ${upstream.status}: ${errBody}`);
      res.status(upstream.status).json({ error: "ElevenLabs upstream error", detail: errBody });
      return;
    }

    const audioBuffer = await upstream.arrayBuffer();

    res.set({
      "Content-Type":  "audio/mpeg",
      "Content-Length": String(audioBuffer.byteLength),
      "Cache-Control": "private, max-age=300",
    });
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error("[TTS] Fetch error:", err);
    res.status(500).json({ error: "Failed to reach ElevenLabs" });
  }
});

export default router;
