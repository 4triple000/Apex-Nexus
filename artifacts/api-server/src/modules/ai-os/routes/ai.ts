/**
 * Apex AI OS — AI Routes
 * Mounted via app.use("/api", router) → actual paths: /api/ai/generate, /api/ai/improve
 */

import { Router } from "express";
import { generateHandler, improveHandler } from "../controllers/aiController";

const router = Router();

router.post("/ai/generate", generateHandler);
router.post("/ai/improve", improveHandler);

export default router;
