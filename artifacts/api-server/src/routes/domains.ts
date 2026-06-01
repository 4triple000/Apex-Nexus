/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX DOMAIN & EMAIL SETTINGS                                            ║
 * ║  Custom domain connection + DNS verification + SMTP config              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import dns from "node:dns/promises";
import net from "node:net";
import { db, customDomainsTable, smtpConfigsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// ─── Replit Hosting Target ─────────────────────────────────────────────────────
const REPLIT_CNAME_TARGET = "replit.app";

// ─── Helper: get userId from session or token ──────────────────────────────────
function getUserId(req: Request): number | null {
  // canvas session from auth routes
  const sessionUserId = (req as any).session?.userId;
  if (sessionUserId) return Number(sessionUserId);
  // canvas token header
  const token = req.headers["x-canvas-user-id"];
  if (token) return Number(token);
  // fallback: demo user 0 so unauthenticated users can still see the page
  return null;
}

// ─── DNS Verification ─────────────────────────────────────────────────────────
async function checkDnsRecords(domain: string): Promise<{
  aRecord: boolean;
  cnameRecord: boolean;
  details: string;
}> {
  let aRecord = false;
  let cnameRecord = false;
  const notes: string[] = [];

  // Check A record
  try {
    const addrs = await dns.resolve4(domain);
    aRecord = addrs.length > 0;
    notes.push(`A: ${addrs.join(", ")}`);
  } catch (e: any) {
    notes.push(`A: not found (${e.code ?? e.message})`);
  }

  // Check CNAME for www subdomain
  try {
    const cnames = await dns.resolveCname(`www.${domain}`);
    cnameRecord = cnames.some(c => c.includes("replit") || c.includes(domain));
    notes.push(`CNAME: ${cnames.join(", ")}`);
  } catch (e: any) {
    // fallback: check A record for www
    try {
      const wwwAddrs = await dns.resolve4(`www.${domain}`);
      cnameRecord = wwwAddrs.length > 0;
      notes.push(`www A: ${wwwAddrs.join(", ")}`);
    } catch {
      notes.push(`CNAME/www: not found`);
    }
  }

  return { aRecord, cnameRecord, details: notes.join(" | ") };
}

// ─── SMTP Connection Test (no external deps) ───────────────────────────────────
async function testSmtpConnection(host: string, port: number): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 8000;

    socket.setTimeout(timeout);

    socket.once("connect", () => {
      socket.destroy();
      resolve({ ok: true, message: `Connected to ${host}:${port} successfully` });
    });

    socket.once("error", (err) => {
      socket.destroy();
      resolve({ ok: false, message: `Connection failed: ${err.message}` });
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, message: `Connection timed out after ${timeout / 1000}s` });
    });

    socket.connect(port, host);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/domains — list user's domains
router.get("/domains", async (req: Request, res: Response) => {
  const userId = getUserId(req) ?? 0;
  try {
    const domains = await db
      .select()
      .from(customDomainsTable)
      .where(eq(customDomainsTable.userId, userId))
      .orderBy(customDomainsTable.createdAt);
    res.json({ domains });
  } catch (err) {
    req.log.error({ err }, "Failed to list domains");
    res.status(500).json({ error: "Failed to list domains" });
  }
});

// POST /api/domains — add a custom domain
const addDomainSchema = z.object({
  domain: z.string().min(3).regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](\.[a-zA-Z]{2,})+$/, "Invalid domain format"),
});

router.post("/domains", async (req: Request, res: Response) => {
  const userId = getUserId(req) ?? 0;
  const parsed = addDomainSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid domain" });
    return;
  }

  const { domain } = parsed.data;
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");

  try {
    const [existing] = await db
      .select({ id: customDomainsTable.id })
      .from(customDomainsTable)
      .where(and(eq(customDomainsTable.userId, userId), eq(customDomainsTable.domain, normalizedDomain)));

    if (existing) {
      res.status(409).json({ error: "Domain already added" });
      return;
    }

    const [row] = await db.insert(customDomainsTable).values({
      userId,
      domain: normalizedDomain,
      status: "pending",
      verificationToken: `apex-verify-${Math.random().toString(36).slice(2, 10)}`,
    }).returning();

    res.json({ domain: row });
  } catch (err) {
    req.log.error({ err }, "Failed to add domain");
    res.status(500).json({ error: "Failed to add domain" });
  }
});

// DELETE /api/domains/:id — remove a domain
router.delete("/domains/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req) ?? 0;
  const id = Number(req.params.id);

  try {
    await db.delete(customDomainsTable).where(
      and(eq(customDomainsTable.id, id), eq(customDomainsTable.userId, userId))
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete domain");
    res.status(500).json({ error: "Failed to delete domain" });
  }
});

// GET /api/domains/:id/verify — manually trigger DNS check
router.get("/domains/:id/verify", async (req: Request, res: Response) => {
  const userId = getUserId(req) ?? 0;
  const id = Number(req.params.id);

  try {
    const [domainRow] = await db
      .select()
      .from(customDomainsTable)
      .where(and(eq(customDomainsTable.id, id), eq(customDomainsTable.userId, userId)));

    if (!domainRow) {
      res.status(404).json({ error: "Domain not found" });
      return;
    }

    const { aRecord, cnameRecord, details } = await checkDnsRecords(domainRow.domain);
    const connected = aRecord || cnameRecord;

    const [updated] = await db
      .update(customDomainsTable)
      .set({
        status: connected ? "connected" : "pending",
        lastCheckedAt: new Date(),
        connectedAt: connected && !domainRow.connectedAt ? new Date() : domainRow.connectedAt,
        errorMessage: connected ? null : `DNS not yet propagated: ${details}`,
        updatedAt: new Date(),
      })
      .where(eq(customDomainsTable.id, id))
      .returning();

    res.json({
      domain: updated,
      dns: { aRecord, cnameRecord, details },
      connected,
    });
  } catch (err) {
    req.log.error({ err }, "DNS verification failed");
    res.status(500).json({ error: "DNS verification failed" });
  }
});

// GET /api/domains/dns-config — get required DNS records for a domain
router.get("/domains/dns-config", async (req: Request, res: Response) => {
  const domain = String(req.query.domain ?? "").toLowerCase().replace(/^www\./, "");
  if (!domain) {
    res.status(400).json({ error: "domain query param required" });
    return;
  }

  // Replit's typical proxy IP — users point to their Replit deployment URL
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN ?? "your-app.replit.app";

  res.json({
    domain,
    records: [
      {
        type: "CNAME",
        name: "www",
        value: replitDevDomain,
        ttl: 3600,
        purpose: "Routes www.yourdomain.com to your Apex app",
      },
      {
        type: "CNAME",
        name: "@",
        value: replitDevDomain,
        ttl: 3600,
        purpose: "Routes yourdomain.com (root) to your Apex app",
        note: "Some registrars call this 'ALIAS' or 'ANAME' at the root",
      },
    ],
    registrarGuides: {
      godaddy: [
        "Log in to GoDaddy → My Products → DNS",
        "Click 'Add' next to DNS Records",
        "Set Type: CNAME, Name: www, Value: " + replitDevDomain,
        "Add another: Type: CNAME (or ALIAS), Name: @, Value: " + replitDevDomain,
        "Click Save. DNS propagation takes 30 min – 48 hours.",
      ],
      namecheap: [
        "Log in to Namecheap → Domain List → Manage",
        "Click 'Advanced DNS' tab",
        "Add a CNAME Record: Host: www, Value: " + replitDevDomain,
        "Add a ALIAS Record: Host: @, Value: " + replitDevDomain,
        "Set TTL to Automatic. Save changes.",
        "DNS propagation takes 30 min – 48 hours.",
      ],
      googleDomains: [
        "Log in to Google Domains → select your domain",
        "Click 'DNS' in the left menu",
        "Under 'Custom records', click 'Manage custom records'",
        "Add record: Type: CNAME, Host name: www, Data: " + replitDevDomain,
        "Add record: Type: CNAME, Host name: @, Data: " + replitDevDomain,
        "Click Save. DNS propagation takes 30 min – 48 hours.",
      ],
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SMTP ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/domains/smtp — list user's SMTP configs (passwords masked)
router.get("/domains/smtp", async (req: Request, res: Response) => {
  const userId = getUserId(req) ?? 0;
  try {
    const rows = await db
      .select({
        id: smtpConfigsTable.id,
        label: smtpConfigsTable.label,
        host: smtpConfigsTable.host,
        port: smtpConfigsTable.port,
        secure: smtpConfigsTable.secure,
        email: smtpConfigsTable.email,
        createdAt: smtpConfigsTable.createdAt,
      })
      .from(smtpConfigsTable)
      .where(eq(smtpConfigsTable.userId, userId));
    res.json({ configs: rows });
  } catch (err) {
    req.log.error({ err }, "Failed to list SMTP configs");
    res.status(500).json({ error: "Failed to list SMTP configs" });
  }
});

// POST /api/domains/smtp — save SMTP config
const smtpSchema = z.object({
  label:    z.string().min(1).default("My Email"),
  host:     z.string().min(1),
  port:     z.number().int().min(1).max(65535).default(587),
  secure:   z.boolean().default(false),
  email:    z.string().email(),
  password: z.string().min(1),
});

router.post("/domains/smtp", async (req: Request, res: Response) => {
  const userId = getUserId(req) ?? 0;
  const parsed = smtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid SMTP config" });
    return;
  }

  try {
    const [row] = await db.insert(smtpConfigsTable).values({
      userId,
      ...parsed.data,
    }).returning({
      id: smtpConfigsTable.id,
      label: smtpConfigsTable.label,
      host: smtpConfigsTable.host,
      port: smtpConfigsTable.port,
      secure: smtpConfigsTable.secure,
      email: smtpConfigsTable.email,
      createdAt: smtpConfigsTable.createdAt,
    });
    res.json({ config: row });
  } catch (err) {
    req.log.error({ err }, "Failed to save SMTP config");
    res.status(500).json({ error: "Failed to save SMTP config" });
  }
});

// DELETE /api/domains/smtp/:id
router.delete("/domains/smtp/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req) ?? 0;
  const id = Number(req.params.id);
  try {
    await db.delete(smtpConfigsTable).where(
      and(eq(smtpConfigsTable.id, id), eq(smtpConfigsTable.userId, userId))
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete SMTP config" });
  }
});

// POST /api/domains/smtp/test — test SMTP connectivity
const smtpTestSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
});

router.post("/domains/smtp/test", async (req: Request, res: Response) => {
  const parsed = smtpTestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid host/port" });
    return;
  }
  const { host, port } = parsed.data;
  const result = await testSmtpConnection(host, port);
  res.json(result);
});

export default router;
