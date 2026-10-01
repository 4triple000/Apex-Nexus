import { Router, type IRouter } from "express";

// ── Legacy route modules (preserved for backwards compatibility) ───────────────
import authRouter from "./auth";
import healthRouter from "./health";
import chatRouter from "./chat";
import usageRouter from "./usage";
import promptsRouter from "./prompts";
import streakRouter from "./streak";
import modelsRouter from "./models";
import connectorsRouter from "./connectors";
import storeRouter from "./store";
import votesRouter from "./votes";
import workflowsRouter from "./workflows";
import dmRouter from "./dm";
import marketplaceRouter from "./marketplace";
import studioRouter from "./studio";
import studioMarketplaceRouter from "./studio_marketplace";
import autopilotRouter from "./autopilot";
import socialRouter from "./social";
import stripeRouter from "./stripe";
import learningRouter from "./learning";
import battleRouter from "./battle";
import waitlistRouter from "./waitlist";

// ── New modular service routers ───────────────────────────────────────────────
import aiOrchestratorRouter from "../modules/ai-orchestrator/router";
import userServiceRouter from "../modules/user-service/router";
import avatarEngineRouter from "../modules/avatar-engine/router";
import memoryRouter from "../modules/memory/router";
import billingRouter from "../modules/billing/router";
import mobileRouter from "../modules/mobile/router";
import workflowGeneratorRouter from "../modules/workflow-generator/router";
import aiStudioRouter from "../modules/ai-studio/router";
import gameProjectsRouter from "../modules/game-projects/router";
import apexAiOsRouter from "../modules/ai-os/index";
import agentsRouter from "../modules/agents/router";
import deploymentRouter from "../modules/deployment/router";
import ameRouter from "../modules/ame/router";
import generateUnityGameRouter from "./generateUnityGame";
import publishGameRouter from "./publishGame";
import messagingRouter from "./messaging";
import webhooksRouter from "./webhooks";
import ttsRouter from "./tts";
import voiceRouter from "./voice";
import gameEngineRouter from "./game-engine";
import gameFeedRouter from "./game-feed";
import devosRouter from "./devos";
import builderRouter from "./builder";
import blockBuilderRouter from "./blockBuilder";
import canvasDataRouter from "./canvasData";
import googleAuthRouter from "./googleAuth";
import storageRouter from "./storage";
import domainsRouter from "./domains";
import runtimeRouter  from "./runtime";
import deployRouter   from "./deploy";
import metricsRouter  from "./metrics";
import usersRouter    from "./users";
import projectsRouter from "./projects";
import builderAgentRouter from "../modules/builder-agent/index";
import { getAutonomousRouter } from "../modules/autonomous/index";
import { getOrchestratorRouter } from "../modules/agents/orchestrator-agent";
import { getGameStudioRouter } from "../modules/game-studio/index";

const router: IRouter = Router();

// ── Legacy routes (existing endpoints, unchanged paths) ───────────────────────
router.use(authRouter);
router.use(healthRouter);
router.use(chatRouter);
router.use(usageRouter);
router.use(promptsRouter);
router.use(streakRouter);
router.use(modelsRouter);
router.use(connectorsRouter);
router.use(storeRouter);
router.use(votesRouter);
router.use(workflowsRouter);
router.use(dmRouter);
router.use(marketplaceRouter);
router.use(studioRouter);
router.use(studioMarketplaceRouter);
router.use(autopilotRouter);
router.use(socialRouter);
router.use(stripeRouter);
router.use(learningRouter);
router.use(battleRouter);
router.use(waitlistRouter);

// ── Modular service routes (new endpoints per production architecture spec) ────
// AI Orchestrator:  /api/ai/chat, /api/ai/think, /api/ai/tool-router, /api/ai/memory-update, /api/ai/models
router.use(aiOrchestratorRouter);
// User Service:     /api/auth/register, /api/auth/login, /api/auth/me, /api/user/profile, /api/user/settings, /api/user/:id
router.use(userServiceRouter);
// Avatar Engine:    /api/avatar/state, /api/avatar/animate, /api/avatar/expression, /api/avatar/voice-sync, /api/avatar/emotion-map
router.use(avatarEngineRouter);
// Memory System:    /api/memory/chat-history, /api/memory/preferences, /api/memory/recall, /api/memory/store, /api/memory/extract, DELETE /api/memory/clear
router.use(memoryRouter);
// Billing:          /api/billing/plans, /api/billing/subscribe, /api/billing/usage, /api/billing/credits, /api/billing/status, /api/billing/portal
router.use(billingRouter);
// Mobile App:       /api/mobile/auth/register, /api/mobile/auth/login, /api/mobile/chat, /api/mobile/conversations, /api/mobile/memory, /api/mobile/extract-memory
router.use(mobileRouter);
// AI Workflow Gen:  GET /api/ai/workflow-schema, POST /api/ai/generate-workflow, /api/ai/validate-workflow, /api/ai/save-workflow
router.use(workflowGeneratorRouter);
// AI Studio:        POST /api/studio/ai/generate, /api/studio/ai/edit, /api/studio/ai/save, GET /api/studio/ai/projects
router.use(aiStudioRouter);
router.use(gameProjectsRouter);
// ── Unified Backend Layer (registered before ai-os to take precedence on /projects) ──
// Users Hub:   GET  /api/users/me, PUT /api/users/me, GET /api/users/me/usage,
//              GET  /api/users/me/projects, GET /api/users/me/deployments, GET /api/users/:id
//              (requireAuth applied per-route — no global middleware conflict)
router.use(usersRouter);
// Projects:    GET|POST /api/projects (session-scoped, ownership-enforced)
//              GET|PUT|DELETE /api/projects/:id (ownership-enforced)
//              GET|POST /api/projects/:id/files, DELETE /api/projects/:id/files/:fid
//              POST /api/projects/:id/deploy
//              (optionalAuth — accepts both session-id and Bearer JWT)
router.use(projectsRouter);
// Builder Agent: POST /api/builder-agent/generate  — SSE stream: prompt → full app
//                POST /api/builder-agent/edit       — SSE stream: instruction → edited app
//                GET  /api/builder-agent/project/:id — project + files + deployment
//                GET  /api/builder-agent/projects    — list session projects
router.use(builderAgentRouter);
// Apex AI OS:       POST /api/ai/generate, /api/ai/improve
//                   GET|POST|PUT|DELETE /api/projects, /api/projects/:id  ← shadowed by projectsRouter above
//                   GET|POST|DELETE /api/os/workflows, /api/os/workflows/:id/run
//                   GET|POST|DELETE /api/os/memory
router.use(apexAiOsRouter);
// Multi-Agent:      GET  /api/agents
//                   POST /api/agents/route           — auto-route task
//                   POST /api/agents/run/:agentId    — run specific agent
//                   POST /api/agents/pipeline        — chain agents
//                   GET  /api/agents/history         — execution history
router.use(agentsRouter);
// Deployment:       POST /api/deploy/:projectId      — run full deployment pipeline
//                   GET  /api/deploy/:projectId/status — poll deployment status
//                   GET  /api/deploy/providers        — list providers + credentials status
router.use(deploymentRouter);
// AME:             POST /api/ame/create-lobby, /api/ame/join-lobby, /api/ame/ready
//                  POST /api/ame/start-matchmaking, /api/ame/leave-matchmaking
//                  GET  /api/ame/status/:playerId, /api/ame/rooms, /api/ame/lobbies
//                  GET  /api/ame/queue-stats, /api/ame/lobby/:id, /api/ame/room/:id
router.use(ameRouter);
// Unity Game Generator: POST /generate-unity-game, GET /generate-unity-game/status
router.use(generateUnityGameRouter);
// Game Publisher:       POST /publish-game, GET /publish-game/:jobId, GET /publish-game/:id/analytics
router.use(publishGameRouter);
// Messaging:            POST /api/messages/send
//                       GET|POST|DELETE /api/connected-accounts, /api/connected-accounts/:id
//                       GET /api/ai-suggestions/:id, POST /api/ai-suggestions/:id/refresh
router.use(messagingRouter);
// Webhooks:             GET|POST /api/webhooks/meta
router.use(webhooksRouter);
// TTS:                  POST /api/tts/generate  — ElevenLabs proxy (key never touches browser)
//                       GET  /api/tts/voices    — list personality-mapped voice profiles
//                       GET  /api/tts/status    — check if ElevenLabs is configured
router.use(ttsRouter);
// Voice Conversation:   POST /api/voice/intent  — classify voice input → intent + mode
//                       POST /api/voice/respond — generate short AI voice reply
router.use(voiceRouter);
// Game Engine:          GET  /api/game/demos          — list demo games
//                       GET  /api/game/demos/:id      — full config for a demo
//                       POST /api/game/generate       — AI game generation from prompt
router.use(gameEngineRouter);
// Game Feed:            GET  /api/game-feed            — trending feed list
//                       POST /api/game-feed/publish   — publish a game to feed
//                       POST /api/game-feed/:id/like  — toggle like
//                       POST /api/game-feed/:id/play  — increment play count
router.use(gameFeedRouter);
// Apex Dev OS:         GET  /api/devos/projects                 — list projects (session-scoped)
//                      POST /api/devos/projects                 — create project + seed file
//                      DEL  /api/devos/projects/:id             — delete project + files + logs
//                      GET  /api/devos/projects/:id/files       — list files
//                      POST /api/devos/projects/:id/files       — create file
//                      PUT  /api/devos/projects/:id/files/:fid  — update file content/path
//                      DEL  /api/devos/projects/:id/files/:fid  — delete file
//                      POST /api/devos/execute                  — run JS in sandbox (vm, 6s timeout)
//                      POST /api/devos/validate                 — syntax check only
//                      POST /api/devos/generate                 — AI generate code from prompt
//                      POST /api/devos/projects/:id/ai-modify   — AI modify file with instruction
//                      POST /api/devos/pipeline                 — full validate→run→test→deploy pipeline
//                      GET  /api/devos/projects/:id/logs        — execution history
//                      DEL  /api/devos/projects/:id/logs        — clear logs
//                      POST /api/devos/engine-hook              — run code in game engine context
router.use(devosRouter);
// Feature Builder:      POST /api/builder/plan         — AI feature plan (all users)
//                       POST /api/builder/apply        — apply code changes (dev-only)
//                       POST /api/builder/snapshot     — create snapshot (dev-only)
//                       GET  /api/builder/snapshots    — list snapshots (dev-only)
//                       POST /api/builder/rollback     — restore snapshot (dev-only)
router.use(builderRouter);
// Block Builder System: POST /api/blockbuilder/generate  — AI autobuilder from prompt
//                       GET  /api/blockbuilder/blueprints — list all blueprints
//                       GET  /api/blockbuilder/blocks     — list all blocks
router.use("/blockbuilder", blockBuilderRouter);
// Canvas Data API:      GET  /api/canvas/messages             — chat messages
//                       POST /api/canvas/messages             — send message + AI reply
//                       GET  /api/canvas/messages/latest      — poll for newest message
//                       GET  /api/canvas/products             — product catalog
//                       POST /api/canvas/products/:id/buy     — purchase product
//                       GET  /api/canvas/leaderboard          — game leaderboard
//                       POST /api/canvas/leaderboard          — submit score
//                       GET  /api/canvas/feed                 — social feed posts
//                       POST /api/canvas/feed/:id/like        — toggle like
//                       POST /api/canvas/feed                 — new post
//                       GET  /api/canvas/stats                — aggregated stats
router.use("/canvas", canvasDataRouter);
// Google OAuth:  GET  /api/auth/google               — redirect to Google consent
//                GET  /api/auth/google/callback       — OAuth callback (sets session)
//                POST /api/auth/google/token          — verify Google ID token (one-tap)
//                GET  /api/auth/google/status         — check if configured
router.use(googleAuthRouter);
// Object Storage: POST /api/storage/uploads/request-url — get presigned upload URL
//                 GET  /api/storage/public-objects/*     — serve public assets
//                 GET  /api/storage/objects/*            — serve private objects
router.use(storageRouter);
// Domain Settings: GET  /api/domains               — list domains
//                  POST /api/domains               — add domain
//                  DELETE /api/domains/:id         — remove domain
//                  GET  /api/domains/:id/verify    — check DNS
//                  GET  /api/domains/dns-config    — get required DNS records
//                  GET  /api/domains/smtp          — list SMTP configs
//                  POST /api/domains/smtp          — save SMTP config
//                  DELETE /api/domains/smtp/:id    — delete SMTP config
//                  POST /api/domains/smtp/test     — test SMTP connection
router.use(domainsRouter);
// Runtime Engine:  POST /api/runtime/execute          — run JS/Python/HTML
//                  GET|POST|DELETE /api/runtime/projects
//                  GET|POST|PUT|DELETE /api/runtime/projects/:id/files
//                  GET /api/runtime/projects/:id/logs
//                  WebSocket namespace /runtime        — streaming output
router.use(runtimeRouter);
// Deploy Engine:   POST /api/deploy/projects/:id      — one-click deploy
//                  GET  /api/deploy/projects/:id/deployments — history
//                  GET  /api/deploy/status/:id         — poll status
//                  GET  /api/deploy/all                — all deployments
//                  GET  /api/apps/:slug                — serve live app (HTML/JS/Python)
//                  GET  /api/apps/:slug/*              — serve multi-file asset
router.use(deployRouter);
// Metrics:         GET /api/metrics/project/:id  — real exec stats from devos_logs
//                  GET /api/metrics/platform     — global platform stats
router.use(metricsRouter);
// (usersRouter and projectsRouter are registered earlier — before apexAiOsRouter)
// Autonomous System:    GET  /api/autonomous/status    — system status + metrics
//                       GET  /api/autonomous/metrics   — observer data
//                       GET  /api/autonomous/suggestions — improvement queue
//                       GET  /api/autonomous/history   — cycle history
//                       POST /api/autonomous/event     — ingest frontend events
//                       POST /api/autonomous/start     — start system
//                       POST /api/autonomous/pause     — pause system
//                       POST /api/autonomous/cycle     — trigger manual cycle
//                       POST /api/autonomous/apply/:id — apply a suggestion (dev-only)
//                       POST /api/autonomous/discard/:id — discard suggestion
router.use(getAutonomousRouter());
// Orchestrator Agent:   GET  /api/agents/orchestrator/status  — master AI status
//                       GET  /api/agents/orchestrator/tasks   — task queue
//                       GET  /api/agents/orchestrator/history — cycle history
//                       POST /api/agents/orchestrator/start   — start system
//                       POST /api/agents/orchestrator/pause   — pause system
//                       POST /api/agents/orchestrator/cycle   — manual cycle trigger
//                       POST /api/agents/orchestrator/approve/:id — admin approve task
//                       POST /api/agents/orchestrator/reject/:id  — admin reject task
//                       POST /api/agents/orchestrator/retry/:id   — retry rejected task
router.use(getOrchestratorRouter());
// Game Studio:        GET  /api/game-studio/status   — studio status + pipeline
//                     GET  /api/game-studio/games    — published game list
//                     GET  /api/game-studio/game/:id — single game
//                     GET  /api/game-studio/history  — run history
//                     POST /api/game-studio/start    — start studio
//                     POST /api/game-studio/pause    — pause studio
//                     POST /api/game-studio/generate — trigger one full cycle
//                     POST /api/game-studio/unpublish/:id — remove game
router.use(getGameStudioRouter());

export default router;
