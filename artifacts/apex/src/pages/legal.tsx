/**
 * Privacy Policy and Terms of Service — public pages (no sign-in needed), linked from the
 * Google sign-in screen and the login page.
 */
import { Link } from "wouter";

const UPDATED = "September 30, 2026";
/** Shown on both pages when set. */
const CONTACT_EMAIL = "";

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mg-font" style={{ minHeight: "100vh", overflowY: "auto", background: "#0A0918", color: "var(--mg-ink, #F3F0FF)", padding: "32px 16px 64px" }}>
      <article style={{ maxWidth: 720, margin: "0 auto", lineHeight: 1.65, fontSize: 15 }}>
        <Link href="/login" style={{ color: "#A5B4FC", fontSize: 14, textDecoration: "none" }}>← Apex</Link>
        <h1 className="mg-display" style={{ fontSize: 32, margin: "16px 0 4px" }}>{title}</h1>
        <p style={{ color: "rgba(243,240,255,0.55)", margin: "0 0 28px", fontSize: 13.5 }}>Last updated {UPDATED}</p>
        {children}
        <p style={{ marginTop: 40, fontSize: 13.5, color: "rgba(243,240,255,0.55)" }}>
          {CONTACT_EMAIL ? <>Questions? Email <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#A5B4FC" }}>{CONTACT_EMAIL}</a>.</> : null}{" "}
          See also: <Link href="/privacy" style={{ color: "#A5B4FC" }}>Privacy Policy</Link> · <Link href="/terms" style={{ color: "#A5B4FC" }}>Terms of Service</Link>
        </p>
      </article>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <h2 style={{ fontSize: 19, margin: "28px 0 8px" }}>{children}</h2>;

export function PrivacyPage() {
  return (
    <Page title="Privacy Policy">
      <p>Apex is an AI assistant, app builder and game studio. This policy explains what we collect, why, and the choices you have.</p>

      <H>What we collect</H>
      <ul>
        <li><strong>Account details:</strong> your email address, username and profile picture. If you sign in with Google, we receive your name, email address and profile picture from Google.</li>
        <li><strong>What you create:</strong> your chats, prompts, memories Apex saves about your preferences, projects, games and anything you publish.</li>
        <li><strong>Usage:</strong> how many AI replies you use each day, which models answered, and the token counts, so we can apply daily limits and keep costs in check.</li>
        <li><strong>Connected accounts (optional):</strong> if you link an AI provider or app in Connectors, we store the key or access token it gives us.</li>
        <li><strong>Payments:</strong> if you subscribe, payments are handled by Stripe. We don't see or store your card number.</li>
      </ul>

      <H>How we use it</H>
      <ul>
        <li>To run your account, answer your messages and keep your projects.</li>
        <li>To personalize replies (for example, remembering your preferences) when memory is turned on.</li>
        <li>To apply plan limits, prevent abuse and understand what our AI costs.</li>
        <li>We don't sell your personal information, and we don't use it for advertising.</li>
      </ul>

      <H>AI providers</H>
      <p>To answer a message, Apex sends it to the AI model you picked (such as OpenAI, Anthropic, Google, xAI, Perplexity, DeepSeek, Mistral, Groq or OpenRouter). Each provider processes it under its own terms and privacy policy. If you link your own account, requests on that model go through your account.</p>

      <H>Connected accounts</H>
      <p>Keys and tokens from Connectors are encrypted before they're stored and are only used for your own requests. For linked apps (such as Google Calendar and Drive, GitHub, Spotify or Notion), Apex reads information only when you ask about it in chat, uses it only to answer you, and doesn't keep a copy beyond that conversation. You can unlink any account at any time in Connectors, which deletes its stored key or token.</p>

      <H>Google user data</H>
      <p>Apex's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ color: "#A5B4FC" }}>Google API Services User Data Policy</a>, including the Limited Use requirements. Google sign-in gives us only your name, email address and profile picture. Data from Google Calendar or Drive, if you link them, is read-only, used only to answer your questions, and never used for advertising or to train AI models.</p>

      <H>Sharing</H>
      <p>We share data only with the services that run Apex (hosting, database, payments and the AI providers above), when you choose to publish something publicly, or when the law requires it.</p>

      <H>Keeping and deleting your data</H>
      <p>We keep your data while your account is open. You can delete chats and projects in the app and unlink connected accounts at any time. To delete your whole account and its data, contact us and we'll remove it.</p>

      <H>Security</H>
      <p>Connections are encrypted in transit, and stored keys and tokens are encrypted at rest. No system is perfectly secure, so please use a strong password and keep your API keys private.</p>

      <H>Children</H>
      <p>Apex isn't meant for children under 13, and we don't knowingly collect their information.</p>

      <H>Changes</H>
      <p>If we change this policy, we'll update the date above. Big changes will be announced in the app.</p>
    </Page>
  );
}

export function TermsPage() {
  return (
    <Page title="Terms of Service">
      <p>By using Apex you agree to these terms.</p>

      <H>Your account</H>
      <p>You're responsible for your account and for keeping your password and any API keys you add private. You must be at least 13 years old to use Apex.</p>

      <H>Using Apex</H>
      <ul>
        <li>Don't use Apex to break the law, harm others, spread malware, or try to get around limits or security.</li>
        <li>Follow the rules of the AI providers and apps you use through Apex.</li>
        <li>Free plans include a daily number of AI credits. We may change limits to keep the service running fairly.</li>
      </ul>

      <H>Your content</H>
      <p>You own what you create in Apex. You give us permission to store and process it so we can run the service, and to show it publicly only where you choose to publish it.</p>

      <H>AI output</H>
      <p>AI replies can be wrong or incomplete. Check important information yourself, especially for health, legal, money or safety decisions.</p>

      <H>Subscriptions</H>
      <p>Paid plans renew automatically until you cancel. You can cancel any time; your plan stays active until the end of the period you paid for. Payments are processed by Stripe.</p>

      <H>Connected accounts</H>
      <p>When you link an AI account (such as OpenRouter or an API key), requests on it are billed by that provider to you, under their terms.</p>

      <H>Changes and ending service</H>
      <p>We may update Apex and these terms. We may suspend accounts that break these terms. You can stop using Apex and ask us to delete your account at any time.</p>

      <H>No warranty</H>
      <p>Apex is provided "as is". To the extent the law allows, we aren't liable for indirect or incidental damages from using it.</p>
    </Page>
  );
}
