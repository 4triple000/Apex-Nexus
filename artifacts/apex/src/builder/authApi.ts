/**
 * Apex Canvas Auth API
 * Connects to the existing production auth system.
 * Session stored in localStorage as canvas_session_id.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const SESSION_KEY = "canvas_session_id";

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionId(id: string): void {
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function authHeaders(): HeadersInit {
  const sid = getSessionId();
  return {
    "Content-Type": "application/json",
    ...(sid ? { "X-Session-Id": sid } : {}),
  };
}

export interface CanvasUser {
  id:       number;
  email:    string;
  username: string;
}

export interface AuthResult {
  user:      CanvasUser;
  sessionId: string;
}

// POST /api/auth/register
export async function register(email: string, password: string, username?: string): Promise<AuthResult> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, username }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Registration failed");
  return data as AuthResult;
}

// POST /api/auth/login
export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return data as AuthResult;
}

// GET /api/auth/me
export async function getMe(): Promise<CanvasUser | null> {
  const sid = getSessionId();
  if (!sid) return null;
  try {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { "X-Session-Id": sid },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as CanvasUser;
  } catch {
    return null;
  }
}

// GET /api/canvas/my-projects  (user's saved builds)
export async function getMyProjects(): Promise<CanvasProject[]> {
  const res = await fetch(`${BASE}/api/canvas/my-projects`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

// POST /api/canvas/my-projects
export async function saveProject(project: Omit<CanvasProject, "id" | "createdAt">): Promise<CanvasProject> {
  const res = await fetch(`${BASE}/api/canvas/my-projects`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error("Failed to save project");
  return res.json();
}

// DELETE /api/canvas/my-projects/:id
export async function deleteProject(id: string): Promise<void> {
  await fetch(`${BASE}/api/canvas/my-projects/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export interface CanvasProject {
  id:         string;
  name:       string;
  prompt:     string;
  blockIds:   string[];
  emoji:      string;
  userId:     number;
  createdAt:  number;
}
