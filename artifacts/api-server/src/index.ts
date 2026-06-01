import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { setupCollaboration } from "./lib/collab";
import { startLearningScheduler } from "./lib/learningEngine";
import { setupApexRealtime } from "./modules/realtime/events";
import { setupCanvasRealtime } from "./modules/realtime/canvasRealtime";
import { setupAME } from "./modules/ame/index";
import { setupGameSockets } from "./routes/game-engine";
import { setupRuntimeSockets } from "./routes/runtime";
import { setupAutonomousSystem } from "./modules/autonomous/index";
import { setupOrchestratorAgent } from "./modules/agents/orchestrator-agent";
import { setupGameStudio } from "./modules/game-studio/index";
import { initJobQueue } from "./core/jobQueue";
import { generateAiSuggestions } from "./core/aiSuggestionService";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Wrap Express in an http.Server so Socket.io can attach to it
const server = createServer(app);

// Attach Socket.io — path /api/socket.io is proxied alongside REST routes
const io = new SocketIOServer(server, {
  path: "/api/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Register collaboration event handlers
setupCollaboration(io);

// Register Apex real-time event system (AI responses, avatar control, workflows)
setupApexRealtime(io);
setupCanvasRealtime(io);

// Register Apex Multiplayer Engine on /ame namespace
setupAME(io);

// Register Game Engine multiplayer socket namespace (/game)
setupGameSockets(io);
// Register Runtime Engine WebSocket namespace (/runtime)
setupRuntimeSockets(io);

server.listen(port, async () => {
  logger.info({ port }, "Server listening");
  logger.info({ path: "/api/socket.io" }, "Socket.io collaboration server ready");
  // Start Apex Autonomous System (observe→analyze→build→test→deploy loop)
  setupAutonomousSystem(io);
  // Start Orchestrator Agent (observe→decide→assign→validate→deploy)
  setupOrchestratorAgent(io);
  // Start Autonomous Game Studio v1 (idea→design→build→test→optimize→publish)
  setupGameStudio(io);
  // Start AI learning scheduler — runs every 15 minutes
  startLearningScheduler(15 * 60_000);
  // Initialize AI suggestion job queue (BullMQ if Redis available, sync fallback)
  await initJobQueue(generateAiSuggestions);
  logger.info("[queue] AI suggestion job queue initialized");
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
