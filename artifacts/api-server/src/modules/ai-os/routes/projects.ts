/**
 * Apex AI OS — Projects Routes
 * Mounted via app.use("/api", router) → actual paths: /api/projects
 */

import { Router } from "express";
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getProjectSummary,
} from "../controllers/projectController";

const router = Router();

router.get("/projects", listProjects);
router.post("/projects", createProject);
router.get("/projects/:id/summary", getProjectSummary);
router.get("/projects/:id", getProject);
router.put("/projects/:id", updateProject);
router.delete("/projects/:id", deleteProject);

export default router;
