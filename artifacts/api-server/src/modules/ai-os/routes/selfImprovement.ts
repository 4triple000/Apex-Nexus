/**
 * Apex AI OS — Self-Improvement Routes
 * Mounted at /api (paths are relative: /api/os/improve/*)
 */

import { Router } from "express";
import {
  runLoopHandler,
  analyzeHandler,
  patternsHandler,
  historyHandler,
  scoreHandler,
  learnedHandler,
} from "../controllers/selfImprovementController";

const router = Router();

router.post("/os/improve/run",      runLoopHandler);
router.post("/os/improve/analyze",  analyzeHandler);
router.post("/os/improve/patterns", patternsHandler);
router.get ("/os/improve/history",  historyHandler);
router.get ("/os/improve/score/:id",scoreHandler);
router.get ("/os/improve/learned",  learnedHandler);

export default router;
