/**
 * Apex AI OS — Module Entry Point
 *
 * Combines all AI OS routers into a single mountable router.
 * Mount this in src/routes/index.ts.
 *
 * Routes registered (app mounts router at /api so these are relative):
 *   GET|POST         /projects         → /api/projects
 *   GET|PUT|DELETE   /projects/:id     → /api/projects/:id
 *   GET              /projects/:id/summary
 *   POST             /ai/generate      → /api/ai/generate
 *   POST             /ai/improve       → /api/ai/improve
 *   GET|POST         /os/workflows     → /api/os/workflows
 *   GET|DELETE       /os/workflows/:id
 *   POST             /os/workflows/:id/run
 *   POST             /os/workflows/validate
 *   GET              /os/workflows/history
 *   GET|POST         /os/memory        → /api/os/memory
 *   GET              /os/memory/summary
 *   GET              /os/memory/patterns
 *   DELETE           /os/memory/:projectId
 *   GET              /os/studio/app-types  → /api/os/studio/app-types
 *   POST             /os/studio/generate   → /api/os/studio/generate
 *   POST             /os/studio/detect-type
 *   POST             /os/studio/decompose
 *   POST             /os/studio/blueprint
 *   POST             /os/studio/code
 *   GET              /os/autopilot/state   → /api/os/autopilot/state
 *   GET              /os/autopilot/history
 *   GET              /os/autopilot/events
 *   PUT              /os/autopilot/mode
 *   POST             /os/autopilot/scan
 *   POST             /os/autopilot/detect
 *   POST             /os/autopilot/fix
 *   POST             /os/improve/run       → /api/os/improve/run
 *   POST             /os/improve/analyze
 *   POST             /os/improve/patterns
 *   GET              /os/improve/history
 *   GET              /os/improve/score/:id
 *   GET              /os/improve/learned
 */

import { Router } from "express";
import projectsRouter from "./routes/projects";
import aiRouter from "./routes/ai";
import workflowsRouter from "./routes/workflows";
import memoryRouter from "./routes/memory";
import studioRouter from "./routes/studio";
import autopilotRouter from "./routes/autopilot";
import selfImprovementRouter from "./routes/selfImprovement";

const router = Router();

router.use(projectsRouter);
router.use(aiRouter);
router.use(workflowsRouter);
router.use(memoryRouter);
router.use(studioRouter);
router.use(autopilotRouter);
router.use(selfImprovementRouter);

export default router;

// Re-export services for use by other modules
export * from "./services/aiService";
export * from "./services/workflowEngine";
export * from "./services/memoryService";
export * from "./core/types";
export * from "./core/config";
