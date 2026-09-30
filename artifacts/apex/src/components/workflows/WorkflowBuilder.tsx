import { useState } from 'react';
import { X, Plus, Trash2, ChevronDown, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  WorkflowDraft,
  WorkflowCondition,
  WorkflowAction,
  ConditionOperator,
  ActionType,
} from '@/hooks/useWorkflows';

const TRIGGERS = [
  { value: 'user_message_received', label: '💬 User Message Received' },
  { value: 'user_signup',           label: '🙋 User Signup' },
  { value: 'api_call_received',     label: '🌐 API Call Received' },
  { value: 'battle_completed',      label: '⚔️ Battle Completed' },
  { value: 'hive_completed',        label: '🐝 Hive Completed' },
  { value: 'schedule_daily',        label: '📅 Daily Schedule' },
  { value: 'custom',                label: '⚡ Custom Event' },
];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'eq',       label: 'equals' },
  { value: 'neq',      label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'gt',       label: 'greater than' },
  { value: 'lt',       label: 'less than' },
  { value: 'exists',   label: 'exists' },
];

const ACTION_TYPES: { value: ActionType; label: string; description: string }[] = [
  { value: 'send_message',    label: '📨 Send Message',    description: 'Send an automated message' },
  { value: 'call_ai_model',   label: '🤖 Call AI Model',   description: 'Query an AI with a prompt' },
  { value: 'update_user_data',label: '📝 Update User Data',description: 'Modify session/user fields' },
  { value: 'trigger_webhook', label: '🔗 Trigger Webhook', description: 'POST to an external URL' },
];

const ACTION_CONFIG_FIELDS: Record<ActionType, { key: string; label: string; placeholder: string }[]> = {
  send_message:     [{ key: 'message',  label: 'Message',    placeholder: 'Enter message text…' }],
  call_ai_model:    [
    { key: 'prompt', label: 'Prompt',    placeholder: 'Enter AI prompt…' },
    { key: 'model',  label: 'Model',     placeholder: 'gpt-4o-mini' },
  ],
  update_user_data: [{ key: 'key',   label: 'Field Key', placeholder: 'e.g. tier' },
                     { key: 'value', label: 'Value',     placeholder: 'e.g. premium' }],
  trigger_webhook:  [{ key: 'url',   label: 'Webhook URL', placeholder: 'https://your-server.com/hook' }],
};

const GOLD = '#A29BFE';
const card: React.CSSProperties = {
  background: 'rgba(30,26,62,0.62)',
  border: '1px solid rgba(162,155,254,0.18)',
  borderRadius: 12,
  padding: 16,
};

const input: React.CSSProperties = {
  background: 'rgba(162,155,254,0.06)',
  border: '1px solid rgba(162,155,254,0.18)',
  borderRadius: 10,
  color: '#f5e070',
  caretColor: GOLD,
  padding: '8px 12px',
  fontSize: 13,
  fontFamily: 'monospace',
  outline: 'none',
  width: '100%',
};

const label: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'monospace',
  color: 'rgba(162,155,254,0.6)',
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

export function WorkflowBuilder({ initial, onSave, onClose, isSaving }: Props) {
  const [name, setName]               = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [trigger, setTrigger]         = useState(initial?.trigger ?? TRIGGERS[0].value);
  const [conditions, setConditions]   = useState<WorkflowCondition[]>(initial?.conditions ?? []);
  const [actions, setActions]         = useState<WorkflowAction[]>(initial?.actions ?? []);
  const [showJson, setShowJson]       = useState(false);

  const draft: WorkflowDraft = { name, description, trigger, conditions, actions };

  const addCondition = () =>
    setConditions((prev) => [...prev, { field: '', operator: 'eq', value: '' }]);

  const removeCondition = (i: number) =>
    setConditions((prev) => prev.filter((_, idx) => idx !== i));

  const updateCondition = <K extends keyof WorkflowCondition>(
    i: number, key: K, value: WorkflowCondition[K]
  ) => setConditions((prev) => prev.map((c, idx) => idx === i ? { ...c, [key]: value } : c));

  const addAction = () =>
    setActions((prev) => [...prev, { type: 'send_message', config: { message: '' } }]);

  const removeAction = (i: number) =>
    setActions((prev) => prev.filter((_, idx) => idx !== i));

  const updateActionType = (i: number, type: ActionType) =>
    setActions((prev) =>
      prev.map((a, idx) => idx === i ? { type, config: {} } : a)
    );

  const updateActionConfig = (i: number, key: string, value: string) =>
    setActions((prev) =>
      prev.map((a, idx) => idx === i ? { ...a, config: { ...a.config, [key]: value } } : a)
    );

  const handleSave = async () => {
    if (!name.trim() || !trigger) return;
    await onSave(draft);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-y-auto">
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border/40"
        style={{ background: 'rgba(30,26,62,0.62)' }}
      >
        <div>
          <h2 className="text-base font-black tracking-wider uppercase" style={{ color: GOLD }}>
            {initial ? 'Edit Workflow' : 'New Workflow'}
          </h2>
          <p className="text-[10px] font-mono text-white/30 tracking-widest">
            AUTOMATION BUILDER
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJson((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
              showJson ? 'text-black' : ''
            )}
            style={showJson
              ? { background: GOLD }
              : { background: 'rgba(162,155,254,0.08)', border: '1px solid rgba(162,155,254,0.25)', color: GOLD }}
          >
            <Eye className="w-3 h-3" />
            JSON
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 pb-28 max-w-lg mx-auto w-full">

        {/* JSON Preview */}
        {showJson && (
          <div style={{ ...card, background: 'transparent' }}>
            <span style={label}>JSON Preview</span>
            <pre
              className="text-[11px] font-mono text-green-400 overflow-x-auto whitespace-pre-wrap"
            >
              {JSON.stringify(draft, null, 2)}
            </pre>
          </div>
        )}

        {/* Name & Description */}
        <div style={card}>
          <span style={label}>Workflow Name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Welcome Message on Signup"
            style={input}
          />
          <div style={{ marginTop: 12 }}>
            <span style={label}>Description (optional)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              style={input}
            />
          </div>
        </div>

        {/* Trigger */}
        <div style={card}>
          <span style={label}>⚡ Trigger — When this happens…</span>
          <div className="relative">
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              style={{ ...input, appearance: 'none', paddingRight: 32, cursor: 'pointer' }}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value} style={{ background: 'rgba(30,26,62,0.62)' }}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: GOLD }} />
          </div>
        </div>

        {/* Conditions */}
        <div style={card}>
          <div className="flex items-center justify-between mb-3">
            <span style={label}>🔎 Conditions (optional filters)</span>
            <button
              onClick={addCondition}
              className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg transition-all active:scale-95"
              style={{ background: 'rgba(162,155,254,0.1)', border: '1px solid rgba(162,155,254,0.2)', color: GOLD }}
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          {conditions.length === 0 && (
            <p className="text-xs font-mono text-white/25 text-center py-3">
              No conditions — workflow runs on every trigger
            </p>
          )}

          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-3 gap-1.5">
                  <input
                    value={c.field}
                    onChange={(e) => updateCondition(i, 'field', e.target.value)}
                    placeholder="field"
                    style={{ ...input, fontSize: 11 }}
                  />
                  <div className="relative">
                    <select
                      value={c.operator}
                      onChange={(e) => updateCondition(i, 'operator', e.target.value as ConditionOperator)}
                      style={{ ...input, fontSize: 11, appearance: 'none', paddingRight: 20 }}
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value} style={{ background: 'rgba(30,26,62,0.62)' }}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {c.operator !== 'exists' && (
                    <input
                      value={c.value ?? ''}
                      onChange={(e) => updateCondition(i, 'value', e.target.value)}
                      placeholder="value"
                      style={{ ...input, fontSize: 11 }}
                    />
                  )}
                </div>
                <button
                  onClick={() => removeCondition(i)}
                  className="mt-1 w-7 h-7 rounded-lg flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={card}>
          <div className="flex items-center justify-between mb-3">
            <span style={label}>🎬 Actions — Then do this…</span>
            <button
              onClick={addAction}
              className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg transition-all active:scale-95"
              style={{ background: 'rgba(162,155,254,0.1)', border: '1px solid rgba(162,155,254,0.2)', color: GOLD }}
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          {actions.length === 0 && (
            <p className="text-xs font-mono text-white/25 text-center py-3">
              Add at least one action
            </p>
          )}

          <div className="space-y-3">
            {actions.map((a, i) => {
              const fields = ACTION_CONFIG_FIELDS[a.type] ?? [];
              return (
                <div
                  key={i}
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                      Step {i + 1}
                    </span>
                    <div className="relative flex-1">
                      <select
                        value={a.type}
                        onChange={(e) => updateActionType(i, e.target.value as ActionType)}
                        style={{ ...input, fontSize: 12, appearance: 'none', paddingRight: 28 }}
                      >
                        {ACTION_TYPES.map((at) => (
                          <option key={at.value} value={at.value} style={{ background: 'rgba(30,26,62,0.62)' }}>
                            {at.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: GOLD }} />
                    </div>
                    <button
                      onClick={() => removeAction(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {fields.map((f) => (
                      <div key={f.key}>
                        <span style={{ ...label, marginBottom: 4 }}>{f.label}</span>
                        <input
                          value={String(a.config[f.key] ?? '')}
                          onChange={(e) => updateActionConfig(i, f.key, e.target.value)}
                          placeholder={f.placeholder}
                          style={{ ...input, fontSize: 12 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div
        className="sticky bottom-0 left-0 right-0 p-4 border-t border-border/40"
        style={{ background: 'rgba(30,26,62,0.62)' }}
      >
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-mono font-bold uppercase tracking-wider transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#999' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-black font-mono uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            style={{ background: GOLD, color: '#000' }}
          >
            {isSaving ? 'Saving…' : 'Save Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}
