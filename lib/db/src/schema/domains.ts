import {
  pgTable, text, integer, timestamp, serial, boolean
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Custom Domains ─────────────────────────────────────────────────────────────

export const customDomainsTable = pgTable("custom_domains", {
  id:                 serial("id").primaryKey(),
  userId:             integer("user_id").notNull(),
  domain:             text("domain").notNull(),
  status:             text("status").notNull().default("pending"), // "pending" | "connected" | "error"
  verificationToken:  text("verification_token"),
  errorMessage:       text("error_message"),
  lastCheckedAt:      timestamp("last_checked_at", { withTimezone: true }),
  connectedAt:        timestamp("connected_at", { withTimezone: true }),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomDomainSchema = createInsertSchema(customDomainsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomDomain = z.infer<typeof insertCustomDomainSchema>;
export type CustomDomain = typeof customDomainsTable.$inferSelect;

// ── SMTP Configurations ────────────────────────────────────────────────────────

export const smtpConfigsTable = pgTable("smtp_configs", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id").notNull(),
  label:        text("label").notNull().default("My Email"),
  host:         text("host").notNull(),
  port:         integer("port").notNull().default(587),
  secure:       boolean("secure").notNull().default(false),
  email:        text("email").notNull(),
  password:     text("password").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSmtpConfigSchema = createInsertSchema(smtpConfigsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSmtpConfig = z.infer<typeof insertSmtpConfigSchema>;
export type SmtpConfig = typeof smtpConfigsTable.$inferSelect;
