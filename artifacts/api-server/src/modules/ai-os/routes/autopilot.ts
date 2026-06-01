/**
 * Apex AI OS — Autopilot Routes
 * Mounted at /api (paths are relative: /api/os/autopilot/*)
 */

import { Router } from "express";
import {
  scanHandler,
  detectHandler,
  fixHandler,
  stateHandler,
  setModeHandler,
  historyHandler,
  eventsHandler,
} from "../controllers/autopilotController";

const router = Router();

router.get ("/os/autopilot/state",   stateHandler);
router.get ("/os/autopilot/history", historyHandler);
router.get ("/os/autopilot/events",  eventsHandler);
router.put ("/os/autopilot/mode",    setModeHandler);
router.post("/os/autopilot/scan",    scanHandler);
router.post("/os/autopilot/detect",  detectHandler);
router.post("/os/autopilot/fix",     fixHandler);

export default router;
