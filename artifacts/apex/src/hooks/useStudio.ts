import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}api${path}`;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error((b as { error?: string }).error ?? `HTTP ${r.status}`);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as T;
}

export type ProjectType = "game" | "ai_tool" | "app" | "automation" | "media";

export interface StudioNode {
  id: string;
  type: string;
  x: number;
  y: number;
  data: Record<string, string | number | boolean>;
}

export interface StudioEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface StudioViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface StudioProject {
  id: number;
  title: string;
  type: ProjectType;
  description?: string | null;
  thumbnail: string;
  nodes: StudioNode[];
  edges: StudioEdge[];
  viewport?: StudioViewport | null;
  runCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExecStep {
  nodeId: string;
  nodeType: string;
  label: string;
  output: string;
  success: boolean;
}

export function useStudioProjects() {
  return useQuery({
    queryKey: ["studio-projects-v2"],
    queryFn: () => req<{ projects: StudioProject[] }>(api("/studio/projects")).then((d) => d.projects),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useStudioProject(id: number | null) {
  return useQuery({
    queryKey: ["studio-project", id],
    queryFn: () => req<{ project: StudioProject }>(api(`/studio/projects/${id}`)).then((d) => d.project),
    enabled: id !== null,
    staleTime: 0,
  });
}

export function useCreateStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; type: ProjectType; description?: string; thumbnail?: string; nodes?: StudioNode[]; edges?: StudioEdge[] }) =>
      req<{ project: StudioProject }>(api("/studio/projects"), { method: "POST", body: JSON.stringify(data) }).then((d) => d.project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio-projects-v2"] }),
  });
}

export function useSaveStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: number;
      title: string;
      type: ProjectType;
      description?: string;
      thumbnail?: string;
      nodes: StudioNode[];
      edges: StudioEdge[];
      viewport?: StudioViewport | null;
    }) => {
      const { id, ...body } = data;
      return req<{ project: StudioProject; graphWarnings?: string[] }>(
        api(`/studio/projects/${id}`),
        { method: "PUT", body: JSON.stringify(body) }
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["studio-projects-v2"] });
      qc.invalidateQueries({ queryKey: ["studio-project", vars.id] });
    },
  });
}

export function useDeleteStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => req<void>(api(`/studio/projects/${id}`), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio-projects-v2"] }),
  });
}

export function useRunStudioProject() {
  return useMutation({
    mutationFn: (data: { id: number; inputs?: Record<string, string> }) =>
      req<{ executionLog: ExecStep[]; finalOutput: string; context: Record<string, string> }>(
        api(`/studio/projects/${data.id}/run`),
        { method: "POST", body: JSON.stringify({ inputs: data.inputs ?? {} }) }
      ),
  });
}
