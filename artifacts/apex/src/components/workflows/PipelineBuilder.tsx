import { useState, useId } from 'react';
import { X, Plus, Trash2, ChevronDown, Eye, EyeOff, ArrowDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_PROVIDERS, PIPELINE_TEMPLATES, getProvider } from './aiProviders';
import type { WorkflowDraft, PipelineStep } from '@/hooks/useWorkflows';

const GOLD = '#A29BFE';

const cardStyle: React.CSSProperties = {
  background: 'rgba(30,26,62,0.62)',
  border: '1px solid rgba(162,155,254,0.15)',
  borderRadius: 14,
  padding: 16,
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#f0f0f0',
  caretColor: GOLD,
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'monospace',
  color: 'rgba(162,155,254,0.55)',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  display: 'block',
  marginBottom: 6,
};

interface Props {
  initial?: Partial<WorkflowDraft>;
  onSave: (draft: WorkflowDraft) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

function newStep(): PipelineStep {
  return { id: Math.random().toString(36).slice(2), name: 'New Step', provider: 'openai', prompt: '', outputKey: '', config: {} };
}

export function PipelineBuilder({ initial, onSave, onClose, isSaving }: Props) {
  const uid = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'custom');
  const [steps, setSteps] = useState<PipelineStep[]>(initial?.steps ?? [newStep()]);
  const [showJson, setShowJson] = useState(false);
  const [showTemplates, setShowTemplates] = useState(!initial?.name);
  const [expandedStep, setExpandedStep] = useState<string | null>(steps[0]?.id ?? null);

  const draft: WorkflowDraft = { name, description, category, trigger: 'manual', steps };

  const addStep = () => {
    const s = newStep();
    setSteps((prev) => [...prev, s]);
    setExpandedStep(s.id);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setExpandedStep(null);
  };

  const updateStep = <K extends keyof PipelineStep>(id: string, key: K, val: PipelineStep[K]) =>
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, [key]: val } : s));

  const applyTemplate = (tplId: string) => {
    const tpl = PIPELINE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setName(tpl.name);
    setDescription(tpl.description);
    setCategory(tpl.category);
    setSteps(tpl.steps.map((s) => ({ ...s, config: {} })));
    setExpandedStep(tpl.steps[0]?.id ?? null);
    setShowTemplates(false);
  };

  const handleSave = async () => {
    if (!name.trim() || steps.length === 0) return;
    await onSave(draft);
  };

  const CATEGORIES = ['custom', 'video', 'game', 'podcast', 'blog', 'marketing', 'thinking'];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#060d1a]">
      {/* ── Header ── */}
      <div
        className="flex-none flex items-center justify-between px-4 py-3 border-b border-white/5"
        style={{ background: 'rgba(30,26,62,0.62)' }}
      >
        <div>
          <h2 className="text-base font-black tracking-wider uppercase" style={{ color: GOLD }}>
            {initial?.name ? 'Edit Pipeline' : 'Build Pipeline'}
          </h2>
          <p className="text-[10px] font-mono text-white/25 tracking-widest">AI WORKFLOW BUILDER</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all"
            style={showTemplates
              ? { background: GOLD, color: '#000' }
              : { background: 'rgba(162,155,254,0.08)', border: '1px solid rgba(162,155,254,0.2)', color: GOLD }}
          >
            Templates
          </button>
          <button
            onClick={() => setShowJson((v) => !v)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}
          >
            {showJson ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">

        {/* Template picker */}
        {showTemplates && (
          <div style={cardStyle}>
            <span style={labelStyle}>⚡ Start from a template</span>
            <div className="grid grid-cols-2 gap-2">
              {PIPELINE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl.id)}
                  className="flex flex-col items-start gap-1.5 p-3 rounded-xl text-left transition-all active:scale-95 hover:brightness-110"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="text-xl">{tpl.icon}</span>
                  <span className="text-[11px] font-bold text-white leading-tight">{tpl.name}</span>
                  <span className="text-[9px] font-mono text-white/35">{tpl.steps.length} steps · {(tpl.uses / 1000).toFixed(1)}k uses</span>
                </button>
              ))}
              <button
                onClick={() => { setSteps([newStep()]); setShowTemplates(false); }}
                className="flex flex-col items-start gap-1.5 p-3 rounded-xl text-left transition-all active:scale-95"
                style={{ background: 'rgba(162,155,254,0.06)', border: '1px dashed rgba(162,155,254,0.2)' }}
              >
                <span className="text-xl">✨</span>
                <span className="text-[11px] font-bold" style={{ color: GOLD }}>Start Blank</span>
                <span className="text-[9px] font-mono text-white/35">Build from scratch</span>
              </button>
            </div>
          </div>
        )}

        {/* Name & category */}
        <div style={cardStyle}>
          <div className="space-y-3">
            <div>
              <label style={labelStyle} htmlFor={`${uid}-name`}>Pipeline Name *</label>
              <input
                id={`${uid}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. YouTube Video Creator"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this pipeline do?"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
                    style={category === cat
                      ? { background: GOLD, color: '#000' }
                      : { background: 'rgba(255,255,255,0.06)', color: '#888' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline steps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span style={{ ...labelStyle, marginBottom: 0 }}>🔗 Pipeline Steps</span>
            <span className="text-[10px] font-mono text-white/30">{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-2">
            {steps.map((step, i) => {
              const prov = getProvider(step.provider);
              const isExpanded = expandedStep === step.id;

              return (
                <div key={step.id}>
                  {/* Step card */}
                  <div
                    className="rounded-2xl overflow-hidden transition-all"
                    style={{
                      border: isExpanded ? `1px solid ${prov.color}40` : '1px solid rgba(255,255,255,0.07)',
                      background: isExpanded ? `${prov.bgColor}` : '#0d1424',
                    }}
                  >
                    {/* Step header (always visible) */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-black"
                        style={{ background: prov.color, color: '#000', fontSize: 12 }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{step.name || 'Unnamed Step'}</span>
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: prov.bgColor, color: prov.color, border: `1px solid ${prov.color}30` }}
                          >
                            {prov.icon} {prov.shortName}
                          </span>
                        </div>
                        {!isExpanded && step.prompt && (
                          <p className="text-[11px] text-white/30 font-mono truncate mt-0.5">
                            {step.prompt.slice(0, 60)}…
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-red-400/40 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronDown
                          className={cn('w-4 h-4 text-white/30 transition-transform', isExpanded && 'rotate-180')}
                        />
                      </div>
                    </button>

                    {/* Expanded config */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                        <div>
                          <label style={labelStyle}>Step Name</label>
                          <input
                            value={step.name}
                            onChange={(e) => updateStep(step.id, 'name', e.target.value)}
                            placeholder="e.g. Script Writing"
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>AI Provider</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {AI_PROVIDERS.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => updateStep(step.id, 'provider', p.id)}
                                className={cn(
                                  'flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-xl text-center transition-all active:scale-95',
                                  step.provider === p.id ? 'ring-2' : 'opacity-60 hover:opacity-100'
                                )}
                                style={step.provider === p.id
                                  ? { background: p.bgColor, border: `1px solid ${p.color}`, '--tw-ring-color': p.color } as React.CSSProperties
                                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                              >
                                <span className="text-lg leading-none">{p.icon}</span>
                                <span className="text-[9px] font-mono font-bold leading-tight" style={{ color: step.provider === p.id ? p.color : '#888' }}>
                                  {p.shortName}
                                </span>
                                {!p.connected && (
                                  <span className="text-[8px] font-mono text-yellow-500/70">key needed</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>
                            Prompt — use {'{{variable}}'} to reference previous outputs
                          </label>
                          <textarea
                            value={step.prompt}
                            onChange={(e) => updateStep(step.id, 'prompt', e.target.value)}
                            placeholder="e.g. Write a YouTube script about {{research}} in a conversational tone..."
                            rows={4}
                            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Output Key (optional)</label>
                          <input
                            value={step.outputKey ?? ''}
                            onChange={(e) => updateStep(step.id, 'outputKey', e.target.value)}
                            placeholder="e.g. script (use as {{script}} in later steps)"
                            style={{ ...inputStyle, fontSize: 12 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Arrow connector */}
                  {i < steps.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="w-4 h-4 text-white/20" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={addStep}
            className="w-full mt-3 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-mono font-bold transition-all active:scale-95"
            style={{ background: 'rgba(162,155,254,0.06)', border: '1px dashed rgba(162,155,254,0.25)', color: GOLD }}
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>

        {/* JSON Preview */}
        {showJson && (
          <div style={{ ...cardStyle, background: 'transparent' }}>
            <span style={labelStyle}>JSON Preview</span>
            <pre className="text-[11px] font-mono text-green-400 overflow-x-auto whitespace-pre-wrap max-h-72 overflow-y-auto">
              {JSON.stringify(draft, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Save bar */}
      <div
        className="flex-none px-4 py-4 border-t border-white/5"
        style={{ background: 'rgba(30,26,62,0.62)' }}
      >
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl text-sm font-mono font-bold uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#888' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || steps.length === 0}
            className="flex-1 py-3.5 rounded-2xl text-sm font-black font-mono uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: GOLD, color: '#000' }}
          >
            <Sparkles className="w-4 h-4" />
            {isSaving ? 'Saving…' : 'Save Pipeline'}
          </button>
        </div>
      </div>
    </div>
  );
}
