import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) { return `${BASE}api${path}`; }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as T;
}

export type ConditionOperator = "eq" | "neq" | "contains" | "gt" | "lt" | "exists";
export type ActionType = "send_message" | "call_ai_model" | "update_user_data" | "trigger_webhook";

export interface WorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value?: string;
}

export interface WorkflowAction {
  type: ActionType;
  config: Record<string, unknown>;
}

export interface PipelineStep {
  id: string;
  name: string;
  provider: string;
  prompt: string;
  outputKey?: string;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  trigger: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  steps: PipelineStep[];
  enabled: boolean;
  isTemplate: boolean;
  shareCode?: string | null;
  authorName?: string | null;
  runCount: number;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDraft {
  name: string;
  description?: string;
  category?: string;
  trigger?: string;
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
  steps?: PipelineStep[];
  enabled?: boolean;
  isTemplate?: boolean;
  authorName?: string;
}

export interface StepResult {
  stepId: string;
  stepName: string;
  provider: string;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export interface PipelineRunResult {
  workflowId: number;
  success: boolean;
  steps: StepResult[];
  context: Record<string, string>;
  totalDurationMs: number;
}

export function useWorkflows() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: () => request<{ workflows: Workflow[] }>(apiUrl("/workflows")).then((d) => d.workflows),
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: WorkflowDraft) =>
      request<{ workflow: Workflow }>(apiUrl("/workflows"), { method: "POST", body: JSON.stringify(draft) })
        .then((d) => d.workflow),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<WorkflowDraft> & { id: number }) =>
      request<{ workflow: Workflow }>(apiUrl(`/workflows/${id}`), { method: "PUT", body: JSON.stringify(data) })
        .then((d) => d.workflow),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useToggleWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<{ workflow: Workflow }>(apiUrl(`/workflows/${id}/toggle`), { method: "PATCH" }).then((d) => d.workflow),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<void>(apiUrl(`/workflows/${id}`), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useCopyWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, authorName }: { id: number; authorName?: string }) =>
      request<{ workflow: Workflow }>(apiUrl(`/workflows/${id}/copy`), {
        method: "POST",
        body: JSON.stringify({ authorName }),
      }).then((d) => d.workflow),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useShareWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<{ workflow: Workflow; shareCode: string }>(apiUrl(`/workflows/${id}/share`), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useRunPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, inputs }: { workflowId: number; inputs: Record<string, string> }) =>
      request<PipelineRunResult>(apiUrl("/workflows/run"), {
        method: "POST",
        body: JSON.stringify({ workflowId, inputs }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useFireTrigger() {
  return useMutation({
    mutationFn: (data: { trigger: string; payload: Record<string, unknown> }) =>
      request<{ results: unknown[]; matchedWorkflows: number }>(apiUrl("/workflows/trigger"), {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
