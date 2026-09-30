// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

export * from "./usage";
export * from "./votes";
export * from "./workflows";
export * from "./dm";
export * from "./prompts";
export * from "./marketplace";
export * from "./studio";
export * from "./studio_marketplace";
export * from "./social";
export * from "./monetization";
export * from "./ai_learning";
export * from "./mobile";
export * from "./ai_studio";
export * from "./ai_os";
export * from "./self_improvement";
export * from "./billing";
export * from "./waitlist";
export * from "./platforms";
export * from "./game_feed";
export * from "./devos";
export * from "./domains";
export * from "./deployments";