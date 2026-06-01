/**
 * Apex AI OS — OS-Level Workflow Routes
 * Mounted via app.use("/api", router) → actual paths: /api/os/workflows/*
 *
 * Note: /api/workflows is taken by the visual studio workflow CRUD.
 * AI OS workflow engine uses /api/os/workflows to avoid conflicts.
 */

import { Router } from "express";
import {
  listWorkflowTemplates,
  listWorkflowsHandler,
  createWorkflowHandler,
  createFromTemplateHandler,
  validateWorkflowHandler,
  getExecutionHistoryHandler,
  getWorkflowHandler,
  updateWorkflowHandler,
  deleteWorkflowHandler,
  runWorkflowHandler,
} from "../controllers/workflowController";

const router = Router();

// ── Specific routes BEFORE :id param ─────────────────────────────────────────
router.get("/os/workflow-templates", listWorkflowTemplates);
router.get("/os/workflows/history", getExecutionHistoryHandler);
router.post("/os/workflows/validate", validateWorkflowHandler);
router.post("/os/workflows/from-template", createFromTemplateHandler);

// ── Collection ────────────────────────────────────────────────────────────────
router.get("/os/workflows", listWorkflowsHandler);
router.post("/os/workflows", createWorkflowHandler);

// ── Single workflow ───────────────────────────────────────────────────────────
router.get("/os/workflows/:id", getWorkflowHandler);
router.put("/os/workflows/:id", updateWorkflowHandler);
router.delete("/os/workflows/:id", deleteWorkflowHandler);
router.post("/os/workflows/:id/run", runWorkflowHandler);

export default router;
