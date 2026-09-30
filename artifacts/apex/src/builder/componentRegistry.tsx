import type { ComponentType } from "react";
import ChatUI        from "./components/ChatUI";
import ButtonUI      from "./components/ButtonUI";
import ProductGrid   from "./components/ProductGrid";
import FeedUI        from "./components/FeedUI";
import GameCanvas    from "./components/GameCanvas";
import FormUI        from "./components/FormUI";
import DashboardUI   from "./components/DashboardUI";
import VideoPlayer   from "./components/VideoPlayer";
import AIAssistant   from "./components/AIAssistant";
import MultiplayerUI from "./components/MultiplayerUI";
import PaymentUI     from "./components/PaymentUI";
import VoiceUI       from "./components/VoiceUI";
import AuthUI        from "./components/AuthUI";
import UserProfile   from "./components/UserProfile";
import FileUploadUI  from "./components/FileUploadUI";
import GoogleSignInButton from "./components/GoogleSignInButton";

export interface BlockComponentProps {
  blockColor?: string;
  blockName?:  string;
}

type RegistryEntry = {
  component:   ComponentType<BlockComponentProps>;
  label:       string;
  description: string;
};

export const COMPONENT_REGISTRY: Record<string, RegistryEntry> = {
  // ── UI Blocks ────────────────────────────────────────────────────────────
  "ui.chatWindow":  { component: ChatUI        as ComponentType<BlockComponentProps>, label: "Chat Window",   description: "Real-time AI chat interface" },
  "ui.button":      { component: ButtonUI      as ComponentType<BlockComponentProps>, label: "Button",        description: "Interactive CTA button" },
  "ui.productGrid": { component: ProductGrid   as ComponentType<BlockComponentProps>, label: "Product Grid",  description: "E-commerce product listing" },
  "ui.feed":        { component: FeedUI        as ComponentType<BlockComponentProps>, label: "Social Feed",   description: "Infinite-scroll content feed" },
  "ui.canvas":      { component: GameCanvas    as ComponentType<BlockComponentProps>, label: "Game Canvas",   description: "Interactive game renderer" },
  "ui.form":        { component: FormUI        as ComponentType<BlockComponentProps>, label: "Form",          description: "Input form with validation" },
  "ui.dashboard":   { component: DashboardUI   as ComponentType<BlockComponentProps>, label: "Dashboard",     description: "Analytics dashboard" },
  "ui.videoPlayer": { component: VideoPlayer   as ComponentType<BlockComponentProps>, label: "Video Player",  description: "Media player with controls" },

  // ── AI Blocks ────────────────────────────────────────────────────────────
  "ai.chatbot":           { component: AIAssistant  as ComponentType<BlockComponentProps>, label: "AI Chatbot",     description: "ChatGPT powered assistant" },
  "ai.optionalAssistant": { component: AIAssistant  as ComponentType<BlockComponentProps>, label: "AI Assistant",   description: "Context-aware helper" },
  "ai.voiceInterface":    { component: VoiceUI      as ComponentType<BlockComponentProps>, label: "Voice Interface", description: "STT + TTS voice pipeline" },

  // ── Network Blocks ───────────────────────────────────────────────────────
  "network.sync":       { component: MultiplayerUI as ComponentType<BlockComponentProps>, label: "Multiplayer Sync", description: "Real-time player sync" },
  "network.paymentAPI": { component: PaymentUI     as ComponentType<BlockComponentProps>, label: "Payment API",      description: "Stripe checkout flow" },

  // ── Auth Blocks ───────────────────────────────────────────────────────────
  "ui.auth":        { component: AuthUI           as ComponentType<BlockComponentProps>, label: "Auth Screen",   description: "Sign up / Login + Google OAuth" },
  "ui.profile":     { component: UserProfile      as ComponentType<BlockComponentProps>, label: "User Profile",  description: "Logged-in user profile and saved apps"  },
  "ui.googleAuth":  { component: GoogleSignInButton as ComponentType<BlockComponentProps>, label: "Google Sign-In", description: "One-tap Google OAuth login" },
  "ui.fileUpload":  { component: FileUploadUI     as ComponentType<BlockComponentProps>, label: "File Upload",   description: "Drag-and-drop GCS file/image storage" },

  // ── Logic Blocks (visual fallback handled in CanvasRenderer) ─────────────
};
