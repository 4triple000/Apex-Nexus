/**
 * Apex AI OS — Memory Log Routes
 * Mounted via app.use("/api", router) → actual paths: /api/os/memory/*
 *
 * Note: /api/memory is taken by the chat memory module.
 * AI OS memory uses /api/os/memory to avoid conflicts.
 */

import { Router } from "express";
import {
  listLogs,
  createLog,
  getMemorySummary,
  analyzePatterns,
  clearProjectLogs,
} from "../controllers/memoryController";

const router = Router();

// Specific paths before :projectId param
router.get("/os/memory/summary", getMemorySummary);
router.get("/os/memory/patterns", analyzePatterns);
router.get("/os/memory", listLogs);
router.post("/os/memory", createLog);
router.delete("/os/memory/:projectId", clearProjectLogs);

export default router;
