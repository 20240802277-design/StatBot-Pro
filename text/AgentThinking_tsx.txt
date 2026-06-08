"use client";

import { useEffect, useState } from "react";
import { Cpu, Sparkles } from "lucide-react";

const STEPS = [
  { label: "Reading CSV data", icon: "📂" },
  { label: "Formulating analysis plan", icon: "🧠" },
  { label: "Writing pandas code", icon: "💻" },
  { label: "Executing in sandbox", icon: "⚙️" },
  { label: "Generating visualizations", icon: "📊" },
  { label: "Compiling final answer", icon: "✨" },
];

export default function AgentThinking() {
  const [stepIndex, setStepIndex] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const stepTimer = setInterval(() => setStepIndex((i) => (i + 1) % STEPS.length), 1600);
    const tickTimer = setInterval(() => setTick((t) => t + 1), 600);
    return () => { clearInterval(stepTimer); clearInterval(tickTimer); };
  }, []);

  const dots = ".".repeat((tick % 3) + 1);

  return (
    <div className="flex items-start gap-3 animate-fade-up">
      {/* Avatar */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15))",
            border: "1px solid rgba(34,211,238,0.3)",
            boxShadow: "var(--shadow-cyan)",
          }}
        >
          <Cpu size={16} className="text-[var(--cyan)]" />
        </div>
        {/* Pulse ring */}
        <span
          className="absolute -inset-1 rounded-xl border border-[var(--cyan)] opacity-40 animate-ping pointer-events-none"
          style={{ animationDuration: "1.5s" }}
        />
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-overlay))",
          border: "1px solid var(--border-accent)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]"
          style={{ background: "rgba(34,211,238,0.04)" }}
        >
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)]"
                style={{
                  animation: "bounce 1s infinite",
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            agent thinking{dots}
          </span>
          <Sparkles size={10} className="ml-auto text-[var(--cyan)] opacity-60" />
        </div>

        {/* Steps */}
        <div className="px-4 py-3 space-y-2">
          {STEPS.map((step, i) => {
            const isDone = i < stepIndex;
            const isCurrent = i === stepIndex;
            const isPending = i > stepIndex;

            return (
              <div
                key={step.label}
                className={`flex items-center gap-2.5 text-xs transition-all duration-400 ${
                  isDone
                    ? "opacity-35 line-through"
                    : isCurrent
                    ? "opacity-100"
                    : isPending
                    ? "opacity-25"
                    : ""
                }`}
              >
                {/* Step indicator */}
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                    isDone
                      ? "border-[var(--text-muted)] bg-[var(--text-muted)]/10"
                      : isCurrent
                      ? "border-[var(--cyan)] bg-[var(--cyan-dim)]"
                      : "border-[var(--border-bright)]"
                  }`}
                >
                  {isDone ? (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] animate-pulse" />
                  ) : (
                    <div className="w-1 h-1 rounded-full bg-[var(--border-bright)]" />
                  )}
                </div>

                <span
                  className={`font-${isCurrent ? "medium" : "normal"}`}
                  style={{ color: isCurrent ? "var(--cyan)" : "var(--text-secondary)" }}
                >
                  {step.icon} {step.label}
                  {isCurrent && dots}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-[var(--border)] mx-4 mb-4 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${((stepIndex + 1) / STEPS.length) * 100}%`,
              background: "linear-gradient(90deg, var(--cyan), var(--violet))",
            }}
          />
        </div>
      </div>
    </div>
  );
}
