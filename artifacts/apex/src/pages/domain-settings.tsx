import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CustomDomain {
  id: number;
  domain: string;
  status: "pending" | "connected" | "error";
  verificationToken?: string;
  errorMessage?: string;
  lastCheckedAt?: string;
  connectedAt?: string;
  createdAt: string;
}

interface DnsConfig {
  domain: string;
  records: Array<{
    type: string;
    name: string;
    value: string;
    ttl: number;
    purpose: string;
    note?: string;
  }>;
  registrarGuides: Record<string, string[]>;
}

interface SmtpConfig {
  id: number;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  email: string;
  createdAt: string;
}

const API = "/api";

// ─── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; dot: string; label: string }> = {
    connected: { color: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30", dot: "bg-emerald-400", label: "Connected" },
    pending:   { color: "bg-amber-500/15 text-amber-400 border border-amber-500/30",   dot: "bg-amber-400",   label: "Pending" },
    error:     { color: "bg-red-500/15 text-red-400 border border-red-500/30",         dot: "bg-red-400",     label: "Error" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === "pending" ? "animate-pulse" : ""}`} />
      {s.label}
    </span>
  );
}

// ─── Section Card ───────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.04] border border-white/10 rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}

// ─── Step List ──────────────────────────────────────────────────────────────────
function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold mt-0.5">
            {i + 1}
          </span>
          <span className="text-white/70">{step}</span>
        </li>
      ))}
    </ol>
  );
}

// ─── Registrar Tabs ─────────────────────────────────────────────────────────────
const REGISTRAR_LABELS: Record<string, string> = {
  godaddy: "GoDaddy",
  namecheap: "Namecheap",
  googleDomains: "Google Domains",
};

// ─── Email Provider Card ────────────────────────────────────────────────────────
function EmailProviderCard({
  logo, name, description, mxRecords, setupSteps,
}: {
  logo: string;
  name: string;
  description: string;
  mxRecords: Array<{ priority: number; host: string; purpose: string }>;
  setupSteps: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{logo}</span>
          <div>
            <div className="font-semibold text-white text-sm">{name}</div>
            <div className="text-white/50 text-xs">{description}</div>
          </div>
        </div>
        <span className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && (
        <div className="border-t border-white/10 p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">MX Records to Add</div>
            <div className="space-y-2">
              {mxRecords.map((mx, i) => (
                <div key={i} className="flex items-start gap-3 bg-black/30 rounded-lg p-3 font-mono text-xs">
                  <span className="text-indigo-400 w-6">{mx.priority}</span>
                  <span className="text-emerald-400 flex-1">{mx.host}</span>
                  <span className="text-white/40">{mx.purpose}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Setup Steps</div>
            <StepList steps={setupSteps} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DNS Record Row ─────────────────────────────────────────────────────────────
function DnsRow({ type, name, value, ttl, purpose, note }: {
  type: string; name: string; value: string; ttl: number; purpose: string; note?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="grid grid-cols-[60px_60px_1fr_80px] gap-3 items-start p-3 bg-black/30 rounded-lg font-mono text-xs">
      <span className="text-purple-400 font-bold">{type}</span>
      <span className="text-amber-400">{name}</span>
      <div>
        <div className="text-emerald-400 break-all">{value}</div>
        {note && <div className="text-white/40 text-xs mt-1 font-sans">{note}</div>}
      </div>
      <button
        onClick={copy}
        className="text-white/40 hover:text-white/80 transition-colors text-xs text-right"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function DomainSettingsPage() {
  const [tab, setTab] = useState<"domain" | "email" | "smtp">("domain");

  // ─── Domain State ───────────────────────────────────────────────────────────
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainError, setDomainError] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<CustomDomain | null>(null);
  const [dnsConfig, setDnsConfig] = useState<DnsConfig | null>(null);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [registrarTab, setRegistrarTab] = useState("godaddy");

  // ─── SMTP State ─────────────────────────────────────────────────────────────
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
  const [smtpForm, setSmtpForm] = useState({
    label: "", host: "", port: 587, secure: false, email: "", password: "",
  });
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpError, setSmtpError] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingSmtp, setTestingSmtp] = useState(false);

  // ─── Load Data ──────────────────────────────────────────────────────────────
  const loadDomains = useCallback(async () => {
    try {
      const res = await fetch(`${API}/domains`);
      const data = await res.json();
      setDomains(data.domains ?? []);
    } catch {}
  }, []);

  const loadSmtp = useCallback(async () => {
    try {
      const res = await fetch(`${API}/domains/smtp`);
      const data = await res.json();
      setSmtpConfigs(data.configs ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    loadDomains();
    loadSmtp();
  }, [loadDomains, loadSmtp]);

  // Auto-poll pending domains every 45 seconds
  useEffect(() => {
    const pending = domains.filter(d => d.status === "pending");
    if (pending.length === 0) return;
    const interval = setInterval(() => {
      pending.forEach(d => triggerVerify(d.id));
    }, 45000);
    return () => clearInterval(interval);
  }, [domains]);

  // ─── Domain Actions ─────────────────────────────────────────────────────────
  const handleAddDomain = async () => {
    if (!domainInput.trim()) return;
    setAddingDomain(true);
    setDomainError("");
    try {
      const res = await fetch(`${API}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setDomainError(data.error ?? "Failed to add domain"); return; }
      setDomains(prev => [...prev, data.domain]);
      setDomainInput("");
      selectDomain(data.domain);
    } catch {
      setDomainError("Network error");
    } finally {
      setAddingDomain(false);
    }
  };

  const handleRemoveDomain = async (id: number) => {
    if (!confirm("Remove this domain?")) return;
    await fetch(`${API}/domains/${id}`, { method: "DELETE" });
    setDomains(prev => prev.filter(d => d.id !== id));
    if (selectedDomain?.id === id) { setSelectedDomain(null); setDnsConfig(null); }
  };

  const selectDomain = async (domain: CustomDomain) => {
    setSelectedDomain(domain);
    setDnsLoading(true);
    try {
      const res = await fetch(`${API}/domains/dns-config?domain=${encodeURIComponent(domain.domain)}`);
      const data = await res.json();
      setDnsConfig(data);
    } catch {}
    setDnsLoading(false);
  };

  const triggerVerify = async (id: number) => {
    setVerifyingId(id);
    try {
      const res = await fetch(`${API}/domains/${id}/verify`);
      const data = await res.json();
      if (data.domain) {
        setDomains(prev => prev.map(d => d.id === id ? data.domain : d));
        if (selectedDomain?.id === id) setSelectedDomain(data.domain);
      }
    } catch {}
    setVerifyingId(null);
  };

  // ─── SMTP Actions ────────────────────────────────────────────────────────────
  const handleSaveSmtp = async () => {
    setSavingSmtp(true);
    setSmtpError("");
    try {
      const res = await fetch(`${API}/domains/smtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtpForm),
      });
      const data = await res.json();
      if (!res.ok) { setSmtpError(data.error ?? "Failed to save"); return; }
      setSmtpConfigs(prev => [...prev, data.config]);
      setSmtpForm({ label: "", host: "", port: 587, secure: false, email: "", password: "" });
    } catch {
      setSmtpError("Network error");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleDeleteSmtp = async (id: number) => {
    if (!confirm("Delete this SMTP config?")) return;
    await fetch(`${API}/domains/smtp/${id}`, { method: "DELETE" });
    setSmtpConfigs(prev => prev.filter(c => c.id !== id));
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/domains/smtp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: smtpForm.host, port: smtpForm.port }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: "Network error" });
    } finally {
      setTestingSmtp(false);
    }
  };

  const TABS = [
    { id: "domain", label: "Domain Connection", icon: "🌐" },
    { id: "email",  label: "Email Setup",        icon: "✉️" },
    { id: "smtp",   label: "SMTP Sender",         icon: "📤" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="text-white/40 hover:text-white/80 transition-colors text-sm">← Back</button>
            </Link>
            <div className="w-px h-4 bg-white/20" />
            <div>
              <h1 className="text-lg font-bold text-white">Domain Settings</h1>
              <p className="text-white/40 text-xs">Connect your domain and set up professional email</p>
            </div>
          </div>
        </div>
        {/* Tab Bar */}
        <div className="max-w-4xl mx-auto px-6 flex gap-1 pb-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                tab === t.id
                  ? "bg-white/[0.08] text-white border-b-2 border-indigo-500"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* ─── DOMAIN TAB ───────────────────────────────────────────────── */}
        {tab === "domain" && (
          <>
            {/* Add Domain */}
            <Card>
              <h2 className="text-base font-semibold text-white mb-1">Connect a Custom Domain</h2>
              <p className="text-white/50 text-sm mb-4">
                Enter your domain name (e.g. <span className="text-white/70 font-mono">apexnexus.io</span>). 
                We'll generate the exact DNS records to configure.
              </p>
              <div className="flex gap-3">
                <input
                  value={domainInput}
                  onChange={e => setDomainInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddDomain()}
                  placeholder="yourdomain.com"
                  className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/60 font-mono"
                />
                <button
                  onClick={handleAddDomain}
                  disabled={addingDomain || !domainInput.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
                >
                  {addingDomain ? "Adding…" : "Connect Domain"}
                </button>
              </div>
              {domainError && <p className="text-red-400 text-sm mt-2">{domainError}</p>}
            </Card>

            {/* Domain List */}
            {domains.length > 0 && (
              <Card>
                <h2 className="text-base font-semibold text-white mb-4">Your Domains</h2>
                <div className="space-y-2">
                  {domains.map(domain => (
                    <div
                      key={domain.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${
                        selectedDomain?.id === domain.id
                          ? "border-indigo-500/50 bg-indigo-500/10"
                          : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                      }`}
                      onClick={() => selectDomain(domain)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-white font-mono text-sm">{domain.domain}</span>
                        <StatusBadge status={domain.status} />
                        {domain.lastCheckedAt && (
                          <span className="text-white/30 text-xs">
                            Checked {new Date(domain.lastCheckedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); triggerVerify(domain.id); }}
                          disabled={verifyingId === domain.id}
                          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 px-2 py-1 rounded-lg border border-indigo-500/30 hover:border-indigo-400/50 transition-colors"
                        >
                          {verifyingId === domain.id ? "Checking…" : "Verify DNS"}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleRemoveDomain(domain.id); }}
                          className="text-xs text-red-400/60 hover:text-red-400 transition-colors px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* DNS Instructions */}
            {selectedDomain && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">
                    DNS Records for <span className="text-indigo-400 font-mono">{selectedDomain.domain}</span>
                  </h2>
                  <StatusBadge status={selectedDomain.status} />
                </div>

                {dnsLoading ? (
                  <div className="text-white/40 text-sm">Loading DNS config…</div>
                ) : dnsConfig ? (
                  <>
                    {selectedDomain.status === "connected" ? (
                      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-4 text-sm text-emerald-400">
                        <span>✓</span>
                        <span>Domain connected successfully! Your DNS records are propagated.</span>
                      </div>
                    ) : (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 text-sm text-amber-400">
                        <strong>Add these DNS records</strong> to your domain registrar. 
                        DNS changes can take 30 minutes to 48 hours to propagate.
                      </div>
                    )}

                    {/* DNS Records Table */}
                    <div className="mb-4">
                      <div className="grid grid-cols-[60px_60px_1fr_80px] gap-3 px-3 mb-2 text-xs font-semibold text-white/30 uppercase tracking-wider">
                        <span>Type</span>
                        <span>Name</span>
                        <span>Value</span>
                        <span></span>
                      </div>
                      <div className="space-y-2">
                        {dnsConfig.records.map((r, i) => (
                          <DnsRow key={i} {...r} />
                        ))}
                      </div>
                    </div>

                    {/* Registrar Guides */}
                    <div>
                      <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                        Step-by-Step Instructions
                      </div>
                      <div className="flex gap-2 mb-3">
                        {Object.keys(REGISTRAR_LABELS).map(key => (
                          <button
                            key={key}
                            onClick={() => setRegistrarTab(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              registrarTab === key
                                ? "bg-indigo-600/40 text-indigo-300 border border-indigo-500/40"
                                : "text-white/40 hover:text-white/70 border border-white/10"
                            }`}
                          >
                            {REGISTRAR_LABELS[key]}
                          </button>
                        ))}
                      </div>
                      <StepList steps={(dnsConfig.registrarGuides as any)[registrarTab] ?? []} />
                    </div>
                  </>
                ) : null}
              </Card>
            )}

            {domains.length === 0 && (
              <div className="text-center py-16 text-white/30">
                <div className="text-5xl mb-4">🌐</div>
                <div className="text-lg font-medium text-white/50 mb-1">No domains connected</div>
                <div className="text-sm">Add your first domain above to get started</div>
              </div>
            )}
          </>
        )}

        {/* ─── EMAIL TAB ────────────────────────────────────────────────── */}
        {tab === "email" && (
          <>
            <Card>
              <h2 className="text-base font-semibold text-white mb-1">Professional Email Setup</h2>
              <p className="text-white/50 text-sm mb-4">
                Choose a provider to set up a professional email like{" "}
                <span className="text-white/70 font-mono">contact@yourdomain.com</span>.
                Click each provider for MX records and step-by-step setup.
              </p>
            </Card>

            <div className="space-y-3">
              <EmailProviderCard
                logo="🇬"
                name="Google Workspace"
                description="Professional Gmail with your domain · $6/user/month"
                mxRecords={[
                  { priority: 1,  host: "aspmx.l.google.com",       purpose: "Primary MX" },
                  { priority: 5,  host: "alt1.aspmx.l.google.com",  purpose: "Alternate 1" },
                  { priority: 5,  host: "alt2.aspmx.l.google.com",  purpose: "Alternate 2" },
                  { priority: 10, host: "alt3.aspmx.l.google.com",  purpose: "Alternate 3" },
                  { priority: 10, host: "alt4.aspmx.l.google.com",  purpose: "Alternate 4" },
                ]}
                setupSteps={[
                  "Go to workspace.google.com and sign up",
                  "Enter your domain name when prompted",
                  "Add the MX records shown above to your DNS registrar",
                  "Verify your domain in Google Admin Console",
                  "Create user accounts: Admin > Directory > Users > Add User",
                  "Your email contact@yourdomain.com is ready!",
                ]}
              />
              <EmailProviderCard
                logo="Z"
                name="Zoho Mail"
                description="Free up to 5 users · $1/user/month for more"
                mxRecords={[
                  { priority: 10, host: "mx.zoho.com",   purpose: "Primary MX" },
                  { priority: 20, host: "mx2.zoho.com",  purpose: "Secondary" },
                  { priority: 50, host: "mx3.zoho.com",  purpose: "Tertiary" },
                ]}
                setupSteps={[
                  "Go to zoho.com/mail and click 'Get Started for Free'",
                  "Choose 'Add an existing domain'",
                  "Enter your domain and verify ownership (TXT record)",
                  "Add the MX records above to your registrar's DNS",
                  "Create email accounts in the Zoho Control Panel",
                  "Send and receive at contact@yourdomain.com",
                ]}
              />
              <EmailProviderCard
                logo="🪟"
                name="Microsoft 365 / Outlook"
                description="Business email with Teams integration · $6/user/month"
                mxRecords={[
                  { priority: 0, host: "yourdomain-com.mail.protection.outlook.com", purpose: "Exchange Online (replace with your actual MX from M365 admin)" },
                ]}
                setupSteps={[
                  "Go to microsoft365.com and choose a Business plan",
                  "During setup, choose 'Use a domain I own'",
                  "Microsoft will show you the exact MX record for your domain",
                  "Add the MX record to your registrar's DNS settings",
                  "Wait for DNS propagation (up to 48 hours)",
                  "Add users in M365 Admin Center > Users > Add a user",
                ]}
              />
            </div>

            <Card>
              <h3 className="font-semibold text-white text-sm mb-3">Which should I choose?</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                {[
                  { name: "Google Workspace", emoji: "🇬", best: "Best for teams already on Google", price: "$6/mo/user" },
                  { name: "Zoho Mail",         emoji: "Z", best: "Best for budget / small teams",    price: "Free – $1/mo" },
                  { name: "Microsoft 365",     emoji: "🪟", best: "Best for Teams + Office users",   price: "$6/mo/user" },
                ].map(p => (
                  <div key={p.name} className="bg-white/[0.03] rounded-xl p-3 space-y-1">
                    <div className="text-lg">{p.emoji}</div>
                    <div className="font-medium text-white/80">{p.name}</div>
                    <div className="text-white/40">{p.best}</div>
                    <div className="text-indigo-400 font-medium">{p.price}</div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ─── SMTP TAB ─────────────────────────────────────────────────── */}
        {tab === "smtp" && (
          <>
            {/* Saved configs */}
            {smtpConfigs.length > 0 && (
              <Card>
                <h2 className="text-base font-semibold text-white mb-4">Saved SMTP Configs</h2>
                <div className="space-y-2">
                  {smtpConfigs.map(cfg => (
                    <div
                      key={cfg.id}
                      className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl border border-white/10"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{cfg.label}</div>
                        <div className="text-xs text-white/40 font-mono">{cfg.email} → {cfg.host}:{cfg.port}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteSmtp(cfg.id)}
                        className="text-xs text-red-400/50 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Add SMTP Config */}
            <Card>
              <h2 className="text-base font-semibold text-white mb-1">Add SMTP Configuration</h2>
              <p className="text-white/50 text-sm mb-5">
                Configure an SMTP server to send emails directly from your app.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-white/50 mb-1.5">Label</label>
                  <input
                    value={smtpForm.label}
                    onChange={e => setSmtpForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="My Email (e.g. Gmail, SendGrid)"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">SMTP Host</label>
                  <input
                    value={smtpForm.host}
                    onChange={e => setSmtpForm(f => ({ ...f, host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/60 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Port</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={smtpForm.port}
                      onChange={e => setSmtpForm(f => ({ ...f, port: Number(e.target.value) }))}
                      className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 font-mono"
                    />
                    <div className="flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-xl px-3">
                      <input
                        type="checkbox"
                        id="secure"
                        checked={smtpForm.secure}
                        onChange={e => setSmtpForm(f => ({ ...f, secure: e.target.checked }))}
                        className="accent-indigo-500"
                      />
                      <label htmlFor="secure" className="text-xs text-white/60 whitespace-nowrap">SSL</label>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1">
                    {[587, 465, 25, 2525].map(p => (
                      <button
                        key={p}
                        onClick={() => setSmtpForm(f => ({ ...f, port: p, secure: p === 465 }))}
                        className={`text-xs px-2 py-0.5 rounded-md transition-colors ${
                          smtpForm.port === p
                            ? "bg-indigo-600/40 text-indigo-300"
                            : "text-white/30 hover:text-white/60"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Email Address</label>
                  <input
                    value={smtpForm.email}
                    onChange={e => setSmtpForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="contact@yourdomain.com"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Password / API Key</label>
                  <input
                    type="password"
                    value={smtpForm.password}
                    onChange={e => setSmtpForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/60"
                  />
                </div>
              </div>

              {smtpError && <p className="text-red-400 text-sm mt-3">{smtpError}</p>}

              {testResult && (
                <div className={`mt-3 flex items-center gap-2 text-sm p-3 rounded-xl ${
                  testResult.ok
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}>
                  <span>{testResult.ok ? "✓" : "✗"}</span>
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleTestSmtp}
                  disabled={testingSmtp || !smtpForm.host}
                  className="px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
                >
                  {testingSmtp ? "Testing…" : "Test Connection"}
                </button>
                <button
                  onClick={handleSaveSmtp}
                  disabled={savingSmtp || !smtpForm.host || !smtpForm.email || !smtpForm.password}
                  className="flex-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
                >
                  {savingSmtp ? "Saving…" : "Save SMTP Config"}
                </button>
              </div>
            </Card>

            {/* Common SMTP Presets */}
            <Card>
              <h3 className="font-semibold text-white text-sm mb-3">Common SMTP Providers</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { name: "Gmail",      host: "smtp.gmail.com",          port: 587, note: "Use App Password, not your real password" },
                  { name: "Outlook",    host: "smtp.office365.com",       port: 587, note: "Use your Microsoft 365 email + password" },
                  { name: "SendGrid",   host: "smtp.sendgrid.net",        port: 587, note: "Use 'apikey' as email, API key as password" },
                  { name: "Mailgun",    host: "smtp.mailgun.org",         port: 587, note: "Use your Mailgun SMTP credentials" },
                  { name: "Amazon SES", host: "email-smtp.us-east-1.amazonaws.com", port: 587, note: "Use SMTP access keys from SES Console" },
                  { name: "Zoho Mail",  host: "smtp.zoho.com",           port: 587, note: "Use your Zoho email + password" },
                ].map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => setSmtpForm(f => ({ ...f, host: preset.host, port: preset.port, label: preset.name }))}
                    className="text-left p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl transition-colors"
                  >
                    <div className="font-medium text-white/80 mb-0.5">{preset.name}</div>
                    <div className="text-white/40 font-mono text-xs">{preset.host}</div>
                    <div className="text-white/30 mt-1">{preset.note}</div>
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
