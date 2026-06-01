/**
 * Apex AI OS — AI Studio Routes
 * Mounted via app.use("/api", router) → actual paths: /api/os/studio/*
 */

import { Router } from "express";
import {
  generateHandler,
  detectTypeHandler,
  decomposeHandler,
  blueprintHandler,
  codeHandler,
  listAppTypesHandler,
} from "../controllers/studioController";

const router = Router();

// Specific routes before param-based routes
router.get("/os/studio/app-types", listAppTypesHandler);
router.post("/os/studio/detect-type", detectTypeHandler);
router.post("/os/studio/decompose", decomposeHandler);
router.post("/os/studio/blueprint", blueprintHandler);
router.post("/os/studio/code", codeHandler);

// Main pipeline entry point
router.post("/os/studio/generate", generateHandler);

export default router;
