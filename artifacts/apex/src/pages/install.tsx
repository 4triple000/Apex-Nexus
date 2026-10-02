/**
 * /install — get Apex on your phone without an app store.
 * Android: download the app file (APK) or install from Chrome. iPhone: add it to the Home Screen from Safari.
 * Works signed out, so the link can be shared.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Download, Share, SquarePlus, Check, Smartphone } from "lucide-react";
import { SocialBackdrop } from "@/components/social/ui";

/** Built by .github/workflows/android.yml and attached to the latest GitHub release */
export const ANDROID_APK_URL = "https://github.com/4triple000/Apex-Nexus/releases/latest/download/apex.apk";
const SITE = "apex-nexus-apex.vercel.app/install";

type Platform = "ios" | "android" | "other";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function detect(): { platform: Platform; safari: boolean; installed: boolean } {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  // Only Safari can add web apps to the iPhone Home Screen with full-screen support on older iOS
  const safari = ios && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV|Line\//.test(ua);
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { platform: ios ? "ios" : android ? "android" : "other", safari, installed };
}

const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04))",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 22,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 10px 30px rgba(0,0,0,0.25)",
  padding: 18,
};
const primary: React.CSSProperties = { height: 50, borderRadius: 25, border: 0, background: "#F5F5F7", color: "#0A0A0C", fontFamily: "Manrope, sans-serif", fontSize: 15.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", cursor: "pointer", width: "100%" };
const ghost: React.CSSProperties = { ...primary, background: "rgba(255,255,255,0.08)", color: "#F3F0FF", border: "1px solid rgba(255,255,255,0.2)" };

export default function InstallPage() {
  const [{ platform, safari, installed }] = useState(detect);
  const [tab, setTab] = useState<"ios" | "android">(platform === "ios" ? "ios" : "android");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [added, setAdded] = useState(false);

  // Chrome on Android offers a one-tap install for web apps
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => setAdded(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const installWebApp = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setAdded(true);
    setPrompt(null);
  };

  return (
    <div className="mg-font" style={{ position: "relative", minHeight: "100dvh", color: "#F3F0FF", fontFamily: "Manrope, sans-serif", overflowX: "hidden" }}>
      <div style={{ position: "fixed", inset: 0 }}><SocialBackdrop /></div>
      <main style={{ position: "relative", maxWidth: 460, margin: "0 auto", padding: "max(28px, env(safe-area-inset-top)) 18px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", marginTop: 12 }}>
          <img src="/icons/icon-192.png" alt="" width={84} height={84} style={{ borderRadius: 24, boxShadow: "0 12px 40px rgba(139,123,255,0.45)" }} />
          <h1 className="mg-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Get the Apex app</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "rgba(243,240,255,0.72)", lineHeight: 1.5, maxWidth: 330 }}>
            Apex on your Home Screen: its own icon, full screen, no browser bars. No app store needed.
          </p>
        </div>

        {installed || added ? (
          <div style={{ ...glass, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(226,193,126,0.18)", display: "grid", placeItems: "center", flexShrink: 0 }}><Check size={20} color="#E2C17E" /></span>
            <div style={{ fontSize: 14.5, lineHeight: 1.45 }}>{installed ? "You're already using the Apex app." : "Apex is installed. Open it from your Home Screen."}</div>
          </div>
        ) : null}

        <div role="tablist" aria-label="Phone" style={{ display: "flex", gap: 6, padding: 4, borderRadius: 24, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {([["android", "Android"], ["ios", "iPhone"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              style={{ flex: 1, height: 40, borderRadius: 20, border: 0, background: tab === id ? "#F5F5F7" : "transparent", color: tab === id ? "#0A0A0C" : "#F3F0FF", fontFamily: "Manrope, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "android" ? (
          <>
            <div style={{ ...glass, display: "flex", flexDirection: "column", gap: 14 }}>
              <a href={ANDROID_APK_URL} style={primary}><Download size={19} /> Download for Android</a>
              <Steps items={[
                <>Tap <b>Download for Android</b>, then open <b>apex.apk</b> when it finishes.</>,
                <>If your phone asks, allow your browser to <b>install unknown apps</b>. Android asks this for any app that isn't from the Play Store.</>,
                <>Tap <b>Install</b>, then <b>Open</b>. Apex is now in your app drawer.</>,
              ]} />
            </div>
            {platform === "android" && prompt ? (
              <div style={{ ...glass, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13.5, color: "rgba(243,240,255,0.72)" }}>Prefer not to download a file? Chrome can add Apex for you.</div>
                <button onClick={() => void installWebApp()} style={ghost}><SquarePlus size={18} /> Install from Chrome</button>
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ ...glass, display: "flex", flexDirection: "column", gap: 14 }}>
            {platform === "ios" && !safari ? (
              <div style={{ padding: 12, borderRadius: 14, background: "rgba(226,193,126,0.1)", border: "1px solid rgba(226,193,126,0.35)", fontSize: 13.5, lineHeight: 1.45, color: "#EED9A8" }}>
                Open this page in <b>Safari</b> first. Copy <b>{SITE}</b> and paste it into Safari.
              </div>
            ) : null}
            <Steps items={[
              <>In <b>Safari</b>, tap the <b>Share</b> button <Share size={15} style={{ display: "inline", verticalAlign: "-2px" }} /> at the bottom of the screen.</>,
              <>Scroll down and tap <b>Add to Home Screen</b> <SquarePlus size={15} style={{ display: "inline", verticalAlign: "-2px" }} />.</>,
              <>Tap <b>Add</b>. Open Apex from its new icon. It runs full screen like any other app.</>,
            ]} />
            <div style={{ fontSize: 12.5, color: "rgba(243,240,255,0.55)", lineHeight: 1.45 }}>
              Apple only allows app files from the App Store, so on iPhone Apex installs straight from Safari instead. It always has the latest version, with nothing to update.
            </div>
          </div>
        )}

        {platform === "other" ? (
          <div style={{ ...glass, display: "flex", alignItems: "center", gap: 12, fontSize: 13.5, lineHeight: 1.45 }}>
            <Smartphone size={22} style={{ flexShrink: 0 }} />
            <span>On your phone, go to <b>{SITE}</b> and follow the steps for your phone.</span>
          </div>
        ) : null}

        <Link href="/" style={{ alignSelf: "center", marginTop: 4, color: "#E2C17E", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>Continue in the browser</Link>
      </main>
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 800 }}>{i + 1}</span>
          <span style={{ paddingTop: 2 }}>{item}</span>
        </li>
      ))}
    </ol>
  );
}
