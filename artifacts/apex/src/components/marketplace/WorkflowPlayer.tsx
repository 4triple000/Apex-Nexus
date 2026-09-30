import { useState, useEffect } from "react";
import type { MarketplaceItem } from "../../hooks/useMarketplace";
import { useRunMarketplaceWorkflow, useTrackPlay } from "../../hooks/useMarketplace";

interface Step {
  id?: string;
  name: string;
  provider: string;
  prompt: string;
  outputKey?: string;
}

const PROVIDER_ICONS: Record<string, string> = {
  openai: "🤖", claude: "🧠", perplexity: "🔍", elevenlabs: "🎙️",
  runway: "🎬", sora: "🌟", veo: "📹", lindy: "🔗", napkin: "📊",
};

interface WorkflowPlayerProps {
  item: MarketplaceItem;
  onClose: () => void;
}

export function WorkflowPlayer({ item, onClose }: WorkflowPlayerProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);

  const runWorkflow = useRunMarketplaceWorkflow();
  const trackPlay = useTrackPlay();

  const steps: Step[] = (item.steps as Step[] | undefined) ?? [];

  // Extract input variables from all step prompts
  const inputVars = [...new Set(
    steps
      .flatMap((s) => [...(s.prompt?.matchAll(/\{\{(\w+)\}\}/g) ?? [])])
      .map(([, v]) => v!)
      .filter(Boolean)
  )];

  const results = runWorkflow.data;
  const isRunning = runWorkflow.isPending;

  async function handleRun() {
    setStarted(true);
    setStartTime(Date.now());
    try {
      await runWorkflow.mutateAsync({ workflowId: item.workflowId, inputs });
      setCompleted(true);
      const duration = Date.now() - (startTime ?? Date.now());
      await trackPlay.mutateAsync({
        marketplaceItemId: item.id,
        workflowId: item.workflowId,
        sessionDurationMs: duration,
        completed: true,
      });
    } catch {
      setCompleted(false);
    }
  }

  function handleClose() {
    if (started && !completed && startTime) {
      void trackPlay.mutateAsync({
        marketplaceItemId: item.id,
        workflowId: item.workflowId,
        sessionDurationMs: Date.now() - startTime,
        completed: false,
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#060610] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-[transparent]">
        <button onClick={handleClose} className="text-white/40 hover:text-white transition-colors">
          ←
        </button>
        <div className="text-2xl">{item.thumbnailEmoji}</div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-sm truncate">{item.title}</h2>
          <p className="text-white/40 text-xs">by {item.authorName} · {steps.length} steps</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/30">
          <span>▶ {item.playCount}</span>
          <span>★ {item.ratingAvg?.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Input Variables */}
        {!started && inputVars.length > 0 && (
          <div className="space-y-3">
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Inputs</p>
            {inputVars.map((varName) => (
              <div key={varName}>
                <label className="text-white/50 text-xs mb-1 block capitalize">{varName.replace(/_/g, " ")}</label>
                <input
                  value={inputs[varName] ?? ""}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [varName]: e.target.value }))}
                  placeholder={`Enter ${varName}...`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#A29BFE]/40"
                />
              </div>
            ))}
          </div>
        )}

        {/* Pipeline visualization */}
        {!started && (
          <div className="space-y-2">
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Pipeline ({steps.length} steps)</p>
            {steps.map((step, i) => (
              <div key={step.id ?? i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50 flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{PROVIDER_ICONS[step.provider] ?? "⚡"}</span>
                    <span className="text-white text-xs font-medium">{step.name}</span>
                    <span className="text-[9px] text-white/30 capitalize">{step.provider}</span>
                  </div>
                  {step.outputKey && (
                    <p className="text-[9px] text-white/25 mt-0.5">outputs → {"{{"}{step.outputKey}{"}}"}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Run Results */}
        {started && (
          <div className="space-y-3">
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">
              {isRunning ? "Running pipeline..." : completed ? "✅ Complete!" : ""}
            </p>
            {isRunning && (
              <div className="flex flex-col gap-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8 animate-pulse">
                    <div className="text-lg">{PROVIDER_ICONS[step.provider] ?? "⚡"}</div>
                    <div className="flex-1">
                      <p className="text-white/60 text-xs">{step.name}</p>
                    </div>
                    <div className="w-3 h-3 rounded-full border-2 border-[#A29BFE]/50 border-t-[#A29BFE] animate-spin" />
                  </div>
                ))}
              </div>
            )}

            {results?.steps && results.steps.map((stepResult, i) => (
              <div key={i} className={`p-4 rounded-xl border ${stepResult.success ? "bg-white/5 border-white/10" : "bg-red-500/10 border-red-500/20"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{PROVIDER_ICONS[steps[i]?.provider ?? ""] ?? "⚡"}</span>
                  <span className="text-white font-medium text-xs">{stepResult.stepName}</span>
                  <span className={`ml-auto text-[9px] font-bold ${stepResult.success ? "text-green-400" : "text-red-400"}`}>
                    {stepResult.success ? "✅" : "❌"}
                  </span>
                </div>
                <p className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap">{stepResult.output}</p>
              </div>
            ))}

            {results?.finalOutput && (
              <div className="p-4 rounded-xl bg-[#A29BFE]/8 border border-[#A29BFE]/25">
                <p className="text-[#A29BFE] font-bold text-xs mb-2">🏁 Final Output</p>
                <p className="text-white/80 text-sm leading-relaxed">{results.finalOutput}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 bg-[transparent]">
        {!started ? (
          <button
            onClick={handleRun}
            disabled={inputVars.some((v) => !inputs[v]?.trim())}
            className="w-full py-4 rounded-xl text-base font-black text-black transition-all disabled:opacity-40 hover:brightness-110 active:scale-95"
            style={{ background: "#A29BFE" }}
          >
            ▶ Run Workflow
          </button>
        ) : completed ? (
          <div className="flex gap-3">
            <button
              onClick={() => { setStarted(false); setCompleted(false); runWorkflow.reset(); }}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/10 text-white/70"
            >
              🔄 Run Again
            </button>
            <button
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-black"
              style={{ background: "#A29BFE" }}
            >
              Done ✓
            </button>
          </div>
        ) : (
          <button disabled className="w-full py-4 rounded-xl text-sm font-medium bg-white/5 text-white/30">
            Running...
          </button>
        )}
      </div>
    </div>
  );
}
