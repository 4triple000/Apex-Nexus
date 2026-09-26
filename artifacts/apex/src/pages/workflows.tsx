import { FeatureGate } from '@/components/ui/FeatureGate';
import { FeaturePreview } from '@/components/ui/FeaturePreview';
import { useState } from 'react';
import {
  Plus, Play, Trash2, ToggleLeft, ToggleRight, Share2, Copy,
  Loader2, Zap, CheckCircle2, XCircle, Clock, ChevronRight,
  Sparkles, Users, Wand2
} from 'lucide-react';
import { Link } from 'wouter';
import {
  useWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
  useToggleWorkflow,
  useDeleteWorkflow,
  useCopyWorkflow,
  useShareWorkflow,
  useRunPipeline,
  type Workflow,
  type WorkflowDraft,
  type PipelineRunResult,
} from '@/hooks/useWorkflows';
import { PipelineBuilder } from '@/components/workflows/PipelineBuilder';
import { PIPELINE_TEMPLATES, getProvider } from '@/components/workflows/aiProviders';
import { MarketplaceFeed } from '@/components/marketplace/MarketplaceFeed';
import { CreatorDashboard } from '@/components/marketplace/CreatorDashboard';
import { cn } from '@/lib/utils';

const GOLD = '#ffcc33';

const CATEGORY_ICONS: Record<string, string> = {
  video: '🎥', game: '🎮', podcast: '🎙️', blog: '✍️',
  marketing: '📱', thinking: '🤝', custom: '⚡',
};

function PipelineFlow({ steps }: { steps: Workflow['steps'] }) {
  const visible = steps.slice(0, 4);
  const extra = steps.length - visible.length;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {visible.map((step, i) => {
        const prov = getProvider(step.provider);
        return (
          <div key={step.id ?? i} className="flex items-center gap-1">
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold"
              style={{ background: prov.bgColor, color: prov.color, border: `1px solid ${prov.color}25` }}
            >
              <span>{prov.icon}</span>
              <span className="hidden sm:inline">{step.name}</span>
            </div>
            {i < visible.length - 1 && <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0" />}
          </div>
        );
      })}
      {extra > 0 && (
        <span className="text-[10px] font-mono text-white/30">+{extra} more</span>
      )}
    </div>
  );
}

interface RunPanelProps {
  workflow: Workflow;
  onClose: () => void;
}

function RunPanel({ workflow, onClose }: RunPanelProps) {
  const runPipeline = useRunPipeline();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PipelineRunResult | null>(null);

  const inputVars = Array.from(
    new Set(
      workflow.steps.flatMap((s) => {
        const matches = s.prompt.matchAll(/\{\{(\w+)\}\}/g);
        return Array.from(matches, (m) => m[1]);
      }).filter((v) => !workflow.steps.some((s) => s.outputKey === v))
    )
  );

  const handleRun = async () => {
    const res = await runPipeline.mutateAsync({ workflowId: workflow.id, inputs });
    setResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#040b14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div>
          <h2 className="text-base font-black" style={{ color: GOLD }}>▶ Run Pipeline</h2>
          <p className="text-[11px] font-mono text-white/30">{workflow.name}</p>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28">
        {/* Input variables */}
        {inputVars.length > 0 && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: '#0d1424', border: '1px solid rgba(255,204,51,0.15)' }}>
            <span className="text-[10px] font-mono text-yellow-400/60 uppercase tracking-widest block">
              📥 Pipeline Inputs
            </span>
            {inputVars.map((v) => (
              <div key={v}>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                  {'{{'}{v}{'}}'}
                </label>
                <input
                  value={inputs[v] ?? ''}
                  onChange={(e) => setInputs({ ...inputs, [v]: e.target.value })}
                  placeholder={`Enter ${v}…`}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,204,51,0.05)', border: '1px solid rgba(255,204,51,0.15)', color: '#f5e070', caretColor: GOLD }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Steps preview */}
        <div className="space-y-2">
          {workflow.steps.map((step, i) => {
            const prov = getProvider(step.provider);
            const stepResult = result?.steps.find((s) => s.stepId === step.id);
            const isRunning = runPipeline.isPending && !result;

            return (
              <div key={step.id ?? i}>
                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: stepResult
                      ? stepResult.success ? 'rgba(16,163,127,0.06)' : 'rgba(239,68,68,0.06)'
                      : '#0d1424',
                    border: stepResult
                      ? `1px solid ${stepResult.success ? '#10a37f40' : '#ef444440'}`
                      : '1px solid rgba(255,255,255,0.07)',
                    transition: 'all 0.3s',
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                      style={{ background: prov.color, color: '#000' }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{step.name}</span>
                        <span className="text-[10px] font-mono" style={{ color: prov.color }}>
                          {prov.icon} {prov.shortName}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isRunning && !stepResult && (
                        <Loader2 className="w-4 h-4 animate-spin text-white/30" />
                      )}
                      {stepResult?.success && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      {stepResult && !stepResult.success && <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                  </div>

                  {stepResult && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Output</span>
                        <span className="text-[9px] font-mono text-white/20">{stepResult.durationMs}ms</span>
                      </div>
                      {stepResult.success ? (
                        <p className="text-[12px] font-mono text-green-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {stepResult.output}
                        </p>
                      ) : (
                        <p className="text-[12px] font-mono text-red-400">{stepResult.error}</p>
                      )}
                    </div>
                  )}
                </div>

                {i < workflow.steps.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <div className="w-px h-4 bg-white/10" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {result && (
          <div
            className="rounded-2xl p-4 text-center"
            style={{
              background: result.success ? 'rgba(16,163,127,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${result.success ? '#10a37f30' : '#ef444430'}`,
            }}
          >
            <div className="text-2xl mb-1">{result.success ? '✅' : '⚠️'}</div>
            <p className="text-sm font-bold" style={{ color: result.success ? '#10a37f' : '#ef4444' }}>
              {result.success ? 'Pipeline completed!' : 'Some steps failed'}
            </p>
            <p className="text-[11px] font-mono text-white/30 mt-1">
              {result.steps.length} steps · {(result.totalDurationMs / 1000).toFixed(1)}s total
            </p>
          </div>
        )}
      </div>

      {/* Run button */}
      <div className="flex-none px-4 py-4 border-t border-white/5" style={{ background: '#040b14' }}>
        <button
          onClick={handleRun}
          disabled={runPipeline.isPending}
          className="w-full py-4 rounded-2xl text-base font-black font-mono uppercase tracking-wider transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: GOLD, color: '#000' }}
        >
          {runPipeline.isPending
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Running Pipeline…</>
            : <><Play className="w-5 h-5" /> {result ? 'Run Again' : 'Run Pipeline'}</>}
        </button>
      </div>
    </div>
  );
}

function WorkflowsPageInner() {
  const { data: workflows, isLoading } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const toggleWorkflow = useToggleWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const copyWorkflow   = useCopyWorkflow();
  const shareWorkflow  = useShareWorkflow();

  const [tab, setTab] = useState<'mine' | 'templates' | 'marketplace' | 'creator'>('mine');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [runningWorkflow, setRunningWorkflow] = useState<Workflow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const handleSave = async (draft: WorkflowDraft) => {
    if (editingWorkflow) {
      await updateWorkflow.mutateAsync({ id: editingWorkflow.id, ...draft });
    } else {
      await createWorkflow.mutateAsync(draft);
    }
    setShowBuilder(false);
    setEditingWorkflow(null);
    setTab('mine');
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await deleteWorkflow.mutateAsync(id); } finally { setDeletingId(null); }
  };

  const handleCopyTemplate = async (tplId: string) => {
    const tpl = PIPELINE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    await createWorkflow.mutateAsync({
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      trigger: 'manual',
      steps: tpl.steps.map((s) => ({ ...s, config: {} })),
    });
    setTab('mine');
  };

  const handleShare = async (id: number) => {
    const result = await shareWorkflow.mutateAsync(id);
    const url = `${window.location.origin}/workflows/share/${result.shareCode}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setShareMsg(`Link copied: …/${result.shareCode}`);
    setTimeout(() => setShareMsg(null), 3500);
  };

  const handleCopy = async (id: number) => {
    await copyWorkflow.mutateAsync({ id });
    setTab('mine');
  };

  const myWorkflows = workflows ?? [];

  return (
    <div className="flex flex-col h-full" style={{ background: '#060d1a' }}>
      {/* ── Header ── */}
      <div className="flex-none px-4 pt-5 pb-0 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-xl font-black tracking-[0.15em] uppercase"
              style={{ color: GOLD, textShadow: '0 0 24px rgba(255,204,51,0.3)' }}
            >
              AI WORKFLOWS
            </h1>
            <p className="text-[10px] font-mono text-white/30 tracking-widest uppercase">
              Multi-step AI pipelines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/workflow-builder">
              <button
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black font-mono uppercase tracking-wider transition-all active:scale-95 border"
                style={{ background: 'rgba(255,204,51,0.1)', color: GOLD, borderColor: 'rgba(255,204,51,0.3)' }}
              >
                <Wand2 className="w-3.5 h-3.5" />
                AI
              </button>
            </Link>
            <button
              onClick={() => { setEditingWorkflow(null); setShowBuilder(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black font-mono uppercase tracking-wider transition-all active:scale-95"
              style={{ background: GOLD, color: '#000' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Build
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {([
            { id: 'mine', label: '⚡ Mine' },
            { id: 'templates', label: '🌐 Templates' },
            { id: 'marketplace', label: '🛒 Market' },
            { id: 'creator', label: '🚀 Creator' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-shrink-0 px-3 pb-2.5 text-[10px] font-mono font-bold uppercase tracking-widest transition-all border-b-2',
                tab === t.id ? '' : 'text-white/30 border-transparent'
              )}
              style={tab === t.id ? { color: GOLD, borderColor: GOLD } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Share toast ── */}
      {shareMsg && (
        <div
          className="mx-4 mt-3 px-4 py-2.5 rounded-xl text-xs font-mono text-center"
          style={{ background: 'rgba(16,163,127,0.15)', border: '1px solid rgba(16,163,127,0.3)', color: '#4ade80' }}
        >
          ✓ {shareMsg}
        </div>
      )}

      {/* ── Body ── */}
      <div className={cn(
        "flex-1 overflow-hidden",
        tab !== 'marketplace' && tab !== 'creator' && "overflow-y-auto px-4 py-4 space-y-3 pb-24"
      )}>

        {/* MY PIPELINES tab */}
        {tab === 'mine' && (
          <>
            {isLoading && (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLD }} />
              </div>
            )}

            {!isLoading && myWorkflows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="text-5xl opacity-30">⚡</div>
                <div className="text-center opacity-50">
                  <p className="font-mono font-bold text-sm uppercase tracking-widest mb-1">No pipelines yet</p>
                  <p className="text-xs text-muted-foreground font-mono">Start from scratch or use a template</p>
                </div>
                <button
                  onClick={() => setTab('templates')}
                  className="px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all active:scale-95"
                  style={{ background: 'rgba(255,204,51,0.1)', border: '1px solid rgba(255,204,51,0.25)', color: GOLD }}
                >
                  Browse Templates →
                </button>
              </div>
            )}

            {myWorkflows.map((wf) => {
              const catIcon = CATEGORY_ICONS[wf.category ?? 'custom'] ?? '⚡';
              return (
                <div
                  key={wf.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: '#0d1424',
                    border: `1px solid ${wf.enabled ? 'rgba(255,204,51,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  {/* Card header */}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: 'rgba(255,204,51,0.08)', border: '1px solid rgba(255,204,51,0.1)' }}
                      >
                        {catIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm" style={{ color: wf.enabled ? '#fff' : '#666' }}>
                            {wf.name}
                          </span>
                          {wf.isTemplate && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,204,51,0.15)', color: GOLD }}>
                              shared
                            </span>
                          )}
                        </div>
                        {wf.description && (
                          <p className="text-[11px] text-white/35 mt-0.5 line-clamp-1">{wf.description}</p>
                        )}
                        <PipelineFlow steps={wf.steps} />
                      </div>
                      <button
                        onClick={() => toggleWorkflow.mutate(wf.id)}
                        className="flex-shrink-0 transition-all active:scale-90"
                      >
                        {wf.enabled
                          ? <ToggleRight className="w-6 h-6" style={{ color: GOLD }} />
                          : <ToggleLeft className="w-6 h-6 text-white/20" />}
                      </button>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-3">
                      <span className="flex items-center gap-1 text-[10px] font-mono text-white/30">
                        <Zap className="w-3 h-3" /> {wf.runCount} runs
                      </span>
                      {wf.lastRunAt && (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-white/30">
                          <Clock className="w-3 h-3" /> {new Date(wf.lastRunAt).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-white/30">
                        {wf.steps.length} step{wf.steps.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 border-t border-white/5"
                    style={{ background: 'rgba(0,0,0,0.2)' }}
                  >
                    <button
                      onClick={() => setRunningWorkflow(wf)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all active:scale-95"
                      style={{ background: 'rgba(255,204,51,0.1)', border: '1px solid rgba(255,204,51,0.2)', color: GOLD }}
                    >
                      <Play className="w-3 h-3" /> Run
                    </button>
                    <button
                      onClick={() => { setEditingWorkflow(wf); setShowBuilder(true); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all active:scale-95"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleShare(wf.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all active:scale-95"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa' }}
                      title="Share workflow"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleCopy(wf.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all active:scale-95"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa' }}
                      title="Duplicate"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(wf.id)}
                      disabled={deletingId === wf.id}
                      className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-mono transition-all active:scale-95 disabled:opacity-50"
                      style={{ color: 'rgba(239,68,68,0.6)' }}
                    >
                      {deletingId === wf.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* TEMPLATES tab */}
        {tab === 'templates' && (
          <div className="space-y-3">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              {PIPELINE_TEMPLATES.length} pre-built pipelines — copy & customize
            </p>

            {PIPELINE_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {/* Gradient header */}
                <div
                  className="px-4 pt-4 pb-3"
                  style={{ background: `linear-gradient(135deg, ${tpl.gradient.includes('135deg') ? tpl.gradient.split('linear-gradient(135deg, ')[1].split(')')[0] : '#1a1a2e 0%, #16213e 100%'})`, opacity: 0.85 }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-3xl mb-1">{tpl.icon}</div>
                      <h3 className="text-base font-black text-white">{tpl.name}</h3>
                      <p className="text-[11px] text-white/60 mt-0.5">{tpl.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-white/50">
                        <Users className="w-3 h-3" />
                        <span>{(tpl.uses / 1000).toFixed(1)}k uses</span>
                      </div>
                      <p className="text-[9px] font-mono text-white/30 mt-0.5">by {tpl.authorName}</p>
                    </div>
                  </div>
                </div>

                {/* Pipeline preview */}
                <div className="px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    {tpl.steps.map((step, i) => {
                      const prov = getProvider(step.provider);
                      return (
                        <div key={step.id} className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                            style={{ background: prov.color, color: '#000' }}
                          >
                            {i + 1}
                          </div>
                          <div
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg flex-1 text-[11px] font-mono"
                            style={{ background: prov.bgColor, border: `1px solid ${prov.color}20` }}
                          >
                            <span>{prov.icon}</span>
                            <span className="font-bold" style={{ color: prov.color }}>{prov.shortName}</span>
                            <span className="text-white/50 truncate">→ {step.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex gap-2 px-4 py-3 border-t border-white/5"
                  style={{ background: 'rgba(0,0,0,0.2)' }}
                >
                  <button
                    onClick={() => handleCopyTemplate(tpl.id)}
                    disabled={createWorkflow.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black font-mono uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: GOLD, color: '#000' }}
                  >
                    {createWorkflow.isPending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <><Sparkles className="w-3.5 h-3.5" /> Use This</>}
                  </button>
                  <button
                    onClick={() => {
                      const tplWf = {
                        name: tpl.name,
                        description: tpl.description,
                        category: tpl.category,
                        trigger: 'manual',
                        steps: tpl.steps.map((s) => ({ ...s, config: {} })),
                      };
                      setEditingWorkflow(null);
                      setShowBuilder(true);
                    }}
                    className="px-3 py-2.5 rounded-xl text-xs font-mono transition-all active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#888' }}
                  >
                    Preview
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MARKETPLACE tab */}
        {tab === 'marketplace' && (
          <div className="h-full flex flex-col overflow-hidden">
            <MarketplaceFeed />
          </div>
        )}

        {/* CREATOR tab */}
        {tab === 'creator' && (
          <div className="h-full flex flex-col overflow-hidden">
            <CreatorDashboard />
          </div>
        )}
      </div>

      {/* Builder overlay */}
      {showBuilder && (
        <PipelineBuilder
          initial={editingWorkflow
            ? {
                ...editingWorkflow,
                description: editingWorkflow.description ?? undefined,
                category: editingWorkflow.category ?? undefined,
                authorName: editingWorkflow.authorName ?? undefined,
              }
            : undefined}
          onSave={handleSave}
          onClose={() => { setShowBuilder(false); setEditingWorkflow(null); }}
          isSaving={createWorkflow.isPending || updateWorkflow.isPending}
        />
      )}

      {/* Run panel overlay */}
      {runningWorkflow && (
        <RunPanel
          workflow={runningWorkflow}
          onClose={() => setRunningWorkflow(null)}
        />
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  return (
    <FeaturePreview feature="workflows">
      <WorkflowsPageInner />
    </FeaturePreview>
  );
}
