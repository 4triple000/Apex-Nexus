# Apex Nexus

AI-powered development platform.

## Layout

| Path | What it is |
| --- | --- |
| `artifacts/apex` | Web app (React + Vite) |
| `artifacts/api-server` | API server (Express + socket.io) |
| `artifacts/apex-mobile` | Mobile app (Expo) |
| `lib/db` | Postgres schema (Drizzle) |
| `lib/api-zod` | Request/response schemas shared by server and web |
| `lib/api-client-react` | React Query hooks for the API |
| `lib/integrations/openai-ai-server` | Shared OpenAI client |

## Getting started

Requires Node 22+ and pnpm 10+.

```sh
pnpm install
cp .env.example .env   # fill in DATABASE_URL, SESSION_SECRET and an OpenAI key
set -a; . ./.env; set +a   # load it into your shell (the server reads real env vars)
pnpm --filter @workspace/db run push   # create database tables
```

Run the API server and the web app (in two terminals):

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/apex run dev   # http://localhost:5000
```

## Checks

```sh
pnpm run typecheck   # all packages
pnpm run build       # typecheck + build everything
```

## Running user code

The Runtime and Dev OS features run user code on the API server. Only signed-in
users can do this. JavaScript runs in a locked-down child process (no file system
or child processes, capped memory and time). Python can't be restricted the same
way, so it is off unless `ALLOW_SERVER_PYTHON=true`. Only turn that on when the
server runs in an isolated container with no secrets. Neither runtime blocks
network access.
