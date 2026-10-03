/**
 * Every AI model Apex offers, grouped by what it's for.
 * A model shows as connected when its API key is set on the server.
 * Chat models answer in Apex chat; the others power creative tools (worlds, 3D, images, voices, video).
 */
import { isOpenAIConfigured } from "@workspace/integrations-openai-ai-server";
import { freePoolConfigured } from "./freeModels";

export type ModelCategory = "chat" | "game" | "image" | "audio" | "video" | "editing";
export type BestFor = "Everyday" | "Game dev" | "Video" | "Creators" | "Research" | "Code";

export interface CatalogModel {
  id: string;
  name: string;
  maker: string;
  category: ModelCategory;
  tagline: string;
  bestFor: BestFor[];
  /** Server environment variable that connects it */
  envKey: string;
  /** Brand color used for its logo tile */
  color: string;
  /** Where to get an API key */
  keyUrl: string;
  /** Chat models can be picked in Apex chat */
  chat?: boolean;
}

export const MODEL_CATALOG: CatalogModel[] = [
  // ── Chat ────────────────────────────────────────────────────────────────────
  { id: "openai", name: "ChatGPT", maker: "OpenAI", category: "chat", chat: true, color: "#10A37F", envKey: "OPENAI_API_KEY", keyUrl: "https://platform.openai.com/api-keys",
    tagline: "Fast, all-round everyday answers", bestFor: ["Everyday", "Code"] },
  { id: "claude", name: "Claude", maker: "Anthropic", category: "chat", chat: true, color: "#D97757", envKey: "ANTHROPIC_API_KEY", keyUrl: "https://console.anthropic.com/settings/keys",
    tagline: "Deep reasoning, writing and code", bestFor: ["Everyday", "Code", "Game dev"] },
  { id: "perplexity", name: "Perplexity", maker: "Perplexity", category: "chat", chat: true, color: "#20B8CD", envKey: "PERPLEXITY_API_KEY", keyUrl: "https://www.perplexity.ai/settings/api",
    tagline: "Live web research with sources", bestFor: ["Research", "Everyday"] },
  { id: "gemini", name: "Gemini", maker: "Google", category: "chat", chat: true, color: "#4E86F7", envKey: "GEMINI_API_KEY", keyUrl: "https://aistudio.google.com/apikey",
    tagline: "Huge context: reads long docs, images and video", bestFor: ["Everyday", "Research", "Creators"] },
  { id: "grok", name: "Grok", maker: "xAI", category: "chat", chat: true, color: "#E7E7E7", envKey: "XAI_API_KEY", keyUrl: "https://console.x.ai",
    tagline: "Bold, witty answers with a real-time feel", bestFor: ["Everyday", "Creators"] },
  { id: "deepseek", name: "DeepSeek", maker: "DeepSeek", category: "chat", chat: true, color: "#4D6BFE", envKey: "DEEPSEEK_API_KEY", keyUrl: "https://platform.deepseek.com/api_keys",
    tagline: "Strong reasoning and code at a low cost", bestFor: ["Code", "Game dev"] },
  { id: "mistral", name: "Mistral", maker: "Mistral AI", category: "chat", chat: true, color: "#FF7000", envKey: "MISTRAL_API_KEY", keyUrl: "https://console.mistral.ai/api-keys",
    tagline: "Fast and great in many languages", bestFor: ["Everyday"] },
  { id: "free", name: "Apex Free", maker: "Groq · Cerebras · GitHub", category: "chat", chat: true, color: "#86EFAC", envKey: "GROQ_API_KEY", keyUrl: "https://console.groq.com/keys",
    tagline: "Free open models, no credits used", bestFor: ["Everyday", "Code"] },
  { id: "llama", name: "Llama", maker: "Meta · via Groq", category: "chat", chat: true, color: "#0866FF", envKey: "GROQ_API_KEY", keyUrl: "https://console.groq.com/keys",
    tagline: "Open model with lightning-fast replies", bestFor: ["Everyday", "Game dev"] },

  // ── Game dev & worlds ───────────────────────────────────────────────────────
  { id: "skybox", name: "Skybox AI", maker: "Blockade Labs", category: "game", color: "#7C5CFF", envKey: "BLOCKADE_LABS_API_KEY", keyUrl: "https://skybox.blockadelabs.com/api-membership",
    tagline: "Whole 360° worlds and skyboxes from one sentence", bestFor: ["Game dev"] },
  { id: "meshy", name: "Meshy", maker: "Meshy", category: "game", color: "#B7F34C", envKey: "MESHY_API_KEY", keyUrl: "https://www.meshy.ai/api",
    tagline: "Text or image to textured, game-ready 3D models", bestFor: ["Game dev"] },
  { id: "tripo", name: "Tripo", maker: "Tripo AI", category: "game", color: "#FFB547", envKey: "TRIPO_API_KEY", keyUrl: "https://platform.tripo3d.ai",
    tagline: "Fast 3D characters with automatic rigging", bestFor: ["Game dev"] },
  { id: "scenario", name: "Scenario", maker: "Scenario", category: "game", color: "#FF5C8A", envKey: "SCENARIO_API_KEY", keyUrl: "https://app.scenario.com",
    tagline: "Game art in your own style: sprites, items, textures", bestFor: ["Game dev"] },
  { id: "leonardo", name: "Leonardo AI", maker: "Leonardo", category: "game", color: "#A970FF", envKey: "LEONARDO_API_KEY", keyUrl: "https://app.leonardo.ai/api-access",
    tagline: "Concept art, characters and environments", bestFor: ["Game dev", "Creators"] },
  { id: "inworld", name: "Inworld", maker: "Inworld AI", category: "game", color: "#3DDC97", envKey: "INWORLD_API_KEY", keyUrl: "https://studio.inworld.ai",
    tagline: "NPCs that talk, remember and have personalities", bestFor: ["Game dev"] },

  // ── Images ──────────────────────────────────────────────────────────────────
  { id: "gpt-image", name: "GPT Image", maker: "OpenAI", category: "image", color: "#10A37F", envKey: "OPENAI_API_KEY", keyUrl: "https://platform.openai.com/api-keys",
    tagline: "Images from a description, and edits in plain words", bestFor: ["Creators", "Everyday"] },
  { id: "flux", name: "FLUX", maker: "Black Forest Labs", category: "image", color: "#F2F2F2", envKey: "BFL_API_KEY", keyUrl: "https://api.bfl.ai",
    tagline: "Photoreal and stylized images with fine detail", bestFor: ["Creators", "Game dev"] },
  { id: "stability", name: "Stable Diffusion", maker: "Stability AI", category: "image", color: "#9D6BFF", envKey: "STABILITY_API_KEY", keyUrl: "https://platform.stability.ai/account/keys",
    tagline: "Images, seamless textures and upscaling", bestFor: ["Game dev", "Creators"] },
  { id: "ideogram", name: "Ideogram", maker: "Ideogram", category: "image", color: "#00C2FF", envKey: "IDEOGRAM_API_KEY", keyUrl: "https://ideogram.ai/manage-api",
    tagline: "Images with clean text: logos, posters, thumbnails", bestFor: ["Creators"] },

  // ── Voice & audio ───────────────────────────────────────────────────────────
  { id: "elevenlabs", name: "ElevenLabs", maker: "ElevenLabs", category: "audio", color: "#F5F5F5", envKey: "ELEVENLABS_API_KEY", keyUrl: "https://elevenlabs.io/app/settings/api-keys",
    tagline: "Lifelike voices for characters, narration and sound effects", bestFor: ["Game dev", "Video", "Creators"] },
  { id: "stable-audio", name: "Stable Audio", maker: "Stability AI", category: "audio", color: "#9D6BFF", envKey: "STABILITY_API_KEY", keyUrl: "https://platform.stability.ai/account/keys",
    tagline: "Music loops and soundtracks from a prompt", bestFor: ["Game dev", "Video"] },
  { id: "whisper", name: "Whisper", maker: "OpenAI", category: "audio", color: "#10A37F", envKey: "OPENAI_API_KEY", keyUrl: "https://platform.openai.com/api-keys",
    tagline: "Speech to text for captions and voice commands", bestFor: ["Video", "Everyday"] },

  // ── AI video ────────────────────────────────────────────────────────────────
  { id: "veo", name: "Veo", maker: "Google", category: "video", color: "#4E86F7", envKey: "GEMINI_API_KEY", keyUrl: "https://aistudio.google.com/apikey",
    tagline: "High-quality video clips with sound from text", bestFor: ["Video", "Creators"] },
  { id: "sora", name: "Sora", maker: "OpenAI", category: "video", color: "#10A37F", envKey: "OPENAI_API_KEY", keyUrl: "https://platform.openai.com/api-keys",
    tagline: "Realistic scenes and short films from a prompt", bestFor: ["Video", "Creators"] },
  { id: "runway", name: "Runway", maker: "Runway", category: "video", color: "#EDEDED", envKey: "RUNWAY_API_KEY", keyUrl: "https://dev.runwayml.com",
    tagline: "Cinematic image-to-video and video-to-video", bestFor: ["Video", "Game dev"] },
  { id: "luma", name: "Dream Machine", maker: "Luma AI", category: "video", color: "#C9A7FF", envKey: "LUMA_API_KEY", keyUrl: "https://lumalabs.ai/dream-machine/api",
    tagline: "Smooth camera moves, great for trailers", bestFor: ["Video", "Game dev"] },
  { id: "kling", name: "Kling", maker: "Kuaishou", category: "video", color: "#34E0A1", envKey: "KLING_API_KEY", keyUrl: "https://app.klingai.com/global/dev",
    tagline: "Longer, realistic motion and characters", bestFor: ["Video"] },

  // ── Video editing & avatars ─────────────────────────────────────────────────
  { id: "shotstack", name: "Shotstack", maker: "Shotstack", category: "editing", color: "#FF6B3D", envKey: "SHOTSTACK_API_KEY", keyUrl: "https://dashboard.shotstack.io",
    tagline: "Automatic editing: cuts, music, titles and captions", bestFor: ["Video", "Creators"] },
  { id: "heygen", name: "HeyGen", maker: "HeyGen", category: "editing", color: "#7B61FF", envKey: "HEYGEN_API_KEY", keyUrl: "https://app.heygen.com/settings",
    tagline: "Talking avatar videos and video translation", bestFor: ["Video", "Creators"] },
  { id: "synthesia", name: "Synthesia", maker: "Synthesia", category: "editing", color: "#4B6BFB", envKey: "SYNTHESIA_API_KEY", keyUrl: "https://www.synthesia.io",
    tagline: "Presenter videos from a script", bestFor: ["Video"] },
];

export const CATEGORY_LABELS: Record<ModelCategory, string> = {
  chat: "Chat",
  game: "Game dev & worlds",
  image: "Images",
  audio: "Voice & audio",
  video: "AI video",
  editing: "Video editing & avatars",
};

export function isConnected(m: CatalogModel): boolean {
  if (m.id === "free") return freePoolConfigured();
  return m.envKey === "OPENAI_API_KEY" ? isOpenAIConfigured() : !!process.env[m.envKey];
}
