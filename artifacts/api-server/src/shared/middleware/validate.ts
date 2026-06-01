/**
 * Request validation middleware using Zod schemas.
 * Use createValidator() to wrap any route with type-safe body/query/params validation.
 */

import type { Response, NextFunction } from "express";
import type { ApexRequest } from "../types";
import { badRequest } from "../utils/response";
import { z, type ZodSchema } from "zod";

type ValidationTarget = "body" | "query" | "params";

interface ValidatorOptions<T> {
  schema: ZodSchema<T>;
  target?: ValidationTarget;
}

export function createValidator<T>(opts: ValidatorOptions<T>) {
  return (req: ApexRequest, res: Response, next: NextFunction): void => {
    const target = opts.target ?? "body";
    const result = opts.schema.safeParse(req[target]);

    if (!result.success) {
      const firstError = result.error.errors[0];
      badRequest(res, `Validation error: ${firstError?.path.join(".")} — ${firstError?.message}`);
      return;
    }

    // Attach parsed data back to request
    (req as unknown as Record<string, unknown>)[`parsed${target.charAt(0).toUpperCase()}${target.slice(1)}`] = result.data;
    next();
  };
}

// ── Common schema fragments ────────────────────────────────────────────────────
export const sessionIdSchema = z.string().uuid("sessionId must be a valid UUID");
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
