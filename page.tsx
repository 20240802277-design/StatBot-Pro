"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Send, Sparkles, Cpu, Trash2, Download, Clock, BarChart2,
  MessageSquare, Zap, ChevronRight, X, GitBranch, Activity,
  Sun, Moon,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import FileDropzone from "@/components/FileDropzone";
import AgentThinking from "@/components/AgentThinking";
import AnalysisResult from "@/components/AnalysisResult";
import DataPreview from "@/components/DataPreview";
import { analyzeCSV, previewDataset } from "@/lib/api";
import type { DatasetInfo, AnalysisResponse, AnalysisHistoryItem } from "@/types";

const EXAMPLE_QUESTIONS = [
  "Who are the genuinely loyal customers vs. those who only buy when there is a discount?",
  "What behavioral patterns today predict high customer value over time?",
  "Which geographies and demographics are commercially underlevered?",
  "How should the brand restructure its promotional strategy to protect margins without losing volume?",
  "What does the brand's ideal customer profile look like, and how can it acquire more of them?",
  "Show the customer pyramid: distribute value tiers across the customer base.",
  "Plot promo dependency vs. retention rate by customer segment.",
  "Which product categories are associated with low purchase history vs high — proxy for entry-point vs retention?",
];

const MAX_CHARS = 500;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useElapsedTime(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

/* ── Sidebar: Recent Questions ─────────────────────────────────── */
function RecentSidebar({
  questions, onSelect, onClose,
}: { questions: string[]; onSelect: (q: string) => void; onClose: () => void }) {
  if (!questions.length) return null;
  return (
    <div className="fixed right-4 top-20 bottom-28 w-64 z-40 pointer-events-none">
      <div className="pointer-events-auto animate-slide-right flex flex-col h-full max-h-full rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]"
          style={{ background: "rgba(34,211,238,0.03)" }}>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Recent</span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <X size={13} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {[...questions].reverse().slice(0, 10).map((q, i) => (
            <button key={i} onClick={() => onSelect(q)}
              className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all group">
              <ChevronRight size={11} className="mt-0.5 flex-shrink-0 text-[var(--text-muted)] group-hover:text-[var(--cyan)] transition-colors" />
              <span className="line-clamp-2 leading-relaxed">{q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Header Stats ───────────────────────────────────────────────── */
function HeaderStats({ file, historyCount, elapsedSeconds }: {
  file: File | null; historyCount: number; elapsedSeconds: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      {file && (
        <span className="badge text-[var(--text-muted)] bg-[var(--bg-overlay)] border border-[var(--border)]">
          <BarChart2 size={10} className="text-[var(--violet)]" />
          {file.name} · {formatBytes(file.size)}
        </span>
      )}
      {historyCount > 0 && (
        <span className="badge text-[var(--text-muted)] bg-[var(--bg-overlay)] border border-[var(--border)]">
          <MessageSquare size={10} className="text-[var(--cyan)]" />
          {historyCount} quer{historyCount !== 1 ? "ies" : "y"}
        </span>
      )}
      {elapsedSeconds > 0 && (
        <span className="badge text-[var(--amber)] bg-[var(--amber)]/10 border border-[var(--amber)]/20">
          <Clock size={10} /> {elapsedSeconds}s
        </span>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function HomePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [datasetInfos, setDatasetInfos] = useState<DatasetInfo[]>([]);
  const file = files[0] || null;
  const datasetInfo = datasetInfos[0] || null;
  
  const [question, setQuestion] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [showRecent, setShowRecent] = useState(false);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const elapsedSeconds = useElapsedTime(isAnalyzing);
  const [isLightMode, setIsLightMode] = useState(false);

  // WebSocket progress indicators
  const [progressMsg, setProgressMsg] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const [progressTotal, setProgressTotal] = useState(5);

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add("light-mode");
    } else {
      document.documentElement.classList.remove("light-mode");
    }
  }, [isLightMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isAnalyzing]);

  useEffect(() => {
    history.forEach((item) => {
      if (!visibleItems.has(item.id)) {
        setTimeout(() => setVisibleItems((prev) => new Set([...prev, item.id])), 50);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  // ⌘K global shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); textareaRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const handleFilesAccepted = (fs: File[], infos: DatasetInfo[]) => {
    setFiles(fs);
    setDatasetInfos(infos);
    setHistory([]);
    setRecentQuestions([]);
    if (fs.length > 0) {
      const totalRows = infos.reduce((sum, inf) => sum + inf.rows, 0);
      toast.success(`Loaded ${fs.length} spreadsheet${fs.length > 1 ? "s" : ""} (${totalRows.toLocaleString()} total rows)`);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (files.length === 0 || !question.trim() || isAnalyzing) return;
    const q = question.trim();
    setQuestion("");
    setIsAnalyzing(true);
    setProgressMsg("Submitting analytical job to background queue...");
    setProgressStep(1);
    setProgressTotal(5);
    setRecentQuestions((prev) => [...prev.filter((x) => x !== q), q]);
    try {
      const response: AnalysisResponse = await analyzeCSV(files, q, sessionId, (msg, step, total) => {
        setProgressMsg(msg);
        setProgressStep(step);
        setProgressTotal(total);
      });
      const item: AnalysisHistoryItem = {
        id: Math.random().toString(36).slice(2),
        question: q, response, timestamp: new Date(),
      };
      setHistory((h) => [...h, item]);
      if (response.status === "error") toast.error("Agent encountered an error.");
      else toast.success("Analysis complete!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      toast.error(msg);
      const errItem: AnalysisHistoryItem = {
        id: Math.random().toString(36).slice(2), question: q,
        response: { session_id: sessionId, status: "error", question: q, charts: [], iterations: 0, error: msg },
        timestamp: new Date(),
      };
      setHistory((h) => [...h, errItem]);
    } finally {
      setIsAnalyzing(false);
      setProgressStep(0);
    }
  }, [files, question, isAnalyzing, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleClear = () => { setHistory([]); setVisibleItems(new Set()); toast("Chat cleared", { icon: "🗑️" }); };

  const handleExport = () => {
    const data = {
      session_id: sessionId, file: file?.name,
      exported_at: new Date().toISOString(),
      conversations: history.map((item) => ({
        question: item.question, answer: item.response.answer,
        status: item.response.status, iterations: item.response.iterations,
        timestamp: item.timestamp.toISOString(),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `statbot-session-${sessionId.slice(0, 6)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Session exported!");
  };

  const charsLeft = MAX_CHARS - question.length;
  const hasData = !!datasetInfo;

  return (
    <div className="min-h-dvh grid-bg flex flex-col" style={{ background: "var(--bg-base)" }}>
      <Toaster position="top-right" toastOptions={{
        style: { background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", fontSize: "13px" },
      }} />

      {/* ── Ambient glow ── */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, var(--glow-cyan) 0%, transparent 70%)" }} />
      <div className="fixed bottom-0 right-0 w-[400px] h-[300px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, var(--glow-violet) 0%, transparent 70%)" }} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)]"
        style={{ background: "rgba(6,9,16,0.85)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(34,211,238,.25),rgba(167,139,250,.25))", border: "1px solid rgba(34,211,238,.4)", boxShadow: "var(--shadow-cyan)" }}>
                <Cpu size={18} className="text-[var(--cyan)] animate-pulse" />
              </div>
              <span className="font-extrabold text-base sm:text-lg tracking-tight select-none">
                StatBot<span className="gradient-text">Pro</span>
              </span>
            </Link>
            <span className="text-[var(--border-bright)] hidden sm:inline text-xs">|</span>
            <div className="hidden sm:flex items-center gap-1 bg-white/5 px-1.5 py-1 rounded-xl border border-[var(--border)]">
              <span className="text-[10px] px-2.5 py-0.5 rounded-lg font-semibold bg-[var(--bg-overlay)] text-[var(--cyan)] border border-white/5 transition-all">
                AI Agent
              </span>
              <Link href="/analytics" className="text-[10px] px-2.5 py-0.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                BI Workspace
              </Link>
            </div>
          </div>

          {/* Center stats */}
          <div className="flex-1 hidden md:flex justify-center">
            <HeaderStats file={file} historyCount={history.length} elapsedSeconds={elapsedSeconds} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {recentQuestions.length > 0 && (
              <button onClick={() => setShowRecent((s) => !s)}
                className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  showRecent
                    ? "border-[var(--cyan)]/40 bg-[var(--cyan-dim)] text-[var(--cyan)]"
                    : "border-[var(--border-bright)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}>
                <Clock size={11} /> History
              </button>
            )}
            {history.length > 0 && (
              <>
                <button onClick={handleExport} className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border-bright)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all">
                  <Download size={11} /> Export
                </button>
                <button onClick={handleClear} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--rose)]/20 bg-[var(--rose)]/5 text-[var(--rose)] hover:bg-[var(--rose)]/10 transition-all">
                  <Trash2 size={11} /> Clear
                </button>
              </>
            )}
            {/* Status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="relative w-1.5 h-1.5 rounded-full bg-[var(--emerald)]">
                <span className="absolute inset-0 rounded-full bg-[var(--emerald)] animate-ping opacity-60" />
              </span>
              AI Analyst: Online
            </div>
            <button
              onClick={() => setIsLightMode((prev) => !prev)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors p-1 rounded-lg flex items-center justify-center"
              title={isLightMode ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {isLightMode ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <a href="https://github.com" target="_blank" rel="noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              <GitBranch size={15} />
            </a>
          </div>
        </div>
      </header>

      {/* Recent sidebar */}
      {showRecent && (
        <RecentSidebar
          questions={recentQuestions}
          onSelect={(q) => { setQuestion(q); textareaRef.current?.focus(); }}
          onClose={() => setShowRecent(false)}
        />
      )}

      {/* ── Main ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6 relative">

        {/* Hero */}
        {history.length === 0 && !isAnalyzing && (
          <div className="text-center pt-10 pb-2 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-accent)] mb-6"
              style={{ background: "var(--cyan-glow)", color: "var(--cyan)", fontSize: "11px", fontWeight: 500 }}>
              <Sparkles size={11} />
              D2C Customer Intelligence Agent — powered by LangChain + GPT-4o
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4" style={{ letterSpacing: "-0.03em" }}>
              Unlock your brand's<br />
              <span className="gradient-text">customer intelligence</span>
            </h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-lg mx-auto leading-relaxed">
              Built for D2C fashion brands. Upload your transactional dataset and discover who your loyal customers
              truly are, how promo-dependent your revenue is, and where your next growth opportunity lies.
            </p>
            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-[var(--text-muted)] flex-wrap">
              <span className="flex items-center gap-1.5"><Zap size={11} className="text-[var(--cyan)]" /> Customer Pyramid</span>
              <span className="flex items-center gap-1.5"><BarChart2 size={11} className="text-[var(--violet)]" /> Promo vs. Loyalty</span>
              <span className="flex items-center gap-1.5"><Activity size={11} className="text-[var(--emerald)]" /> Geo Opportunity</span>
              <span className="flex items-center gap-1.5"><MessageSquare size={11} className="text-[var(--amber)]" /> Retention Playbook</span>
            </div>
          </div>
        )}

        {/* File upload */}
        <section>
          <FileDropzone onFilesAccepted={handleFilesAccepted} onPreview={previewDataset} isLoading={isAnalyzing} />
        </section>

        {/* Dataset preview */}
        {datasetInfo && <DataPreview info={datasetInfo} />}

        {/* Example questions */}
        {history.length === 0 && !isAnalyzing && hasData && (
          <div className="space-y-3 animate-fade-up">
            <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-widest font-semibold px-1">
              💡 Try asking
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button key={q}
                  onClick={() => { setQuestion(q); textareaRef.current?.focus(); }}
                  className="text-left px-4 py-3 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-start gap-2 group"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(34,211,238,0.3)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,211,238,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
                  }}>
                  <Sparkles size={11} className="text-[var(--cyan)]/40 mt-0.5 flex-shrink-0 group-hover:text-[var(--cyan)] transition-colors" />
                  <span className="leading-relaxed">{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation history */}
        {history.length > 0 && (
          <section className="space-y-8">
            {history.map((item) => (
              <div key={item.id}
                className={`space-y-3 transition-all duration-500 ${
                  visibleItems.has(item.id) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}>
                {/* User bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl px-4 py-3"
                    style={{ background: "linear-gradient(135deg,rgba(34,211,238,.08),rgba(167,139,250,.05))", border: "1px solid rgba(34,211,238,.2)" }}>
                    <p className="text-sm text-[var(--text-primary)]">{item.question}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                      {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                {/* Agent response */}
                <AnalysisResult result={item.response} />
              </div>
            ))}
          </section>
        )}

        {/* Agent thinking */}
        {isAnalyzing && (
          <div className="space-y-4 max-w-xl mx-auto p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] w-full">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--cyan)] flex items-center gap-1.5">
                <Sparkles size={12} className="animate-pulse text-[var(--cyan)]" /> {progressMsg || "Initializing analytical task..."}
              </span>
              <span className="font-mono text-[var(--text-muted)] font-medium">
                Step {progressStep || 1} of {progressTotal || 5}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[var(--cyan)] to-[var(--violet)] transition-all duration-300 animate-pulse"
                style={{ width: `${((progressStep || 1) / (progressTotal || 5)) * 100}%` }} />
            </div>
            <AgentThinking />
            {elapsedSeconds > 0 && (
              <p className="text-[10px] text-[var(--text-muted)] text-center font-mono">
                ⏱ Running in background queue · Elapsed: {elapsedSeconds}s
              </p>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Input Bar ── */}
      {hasData && (
        <div className="sticky bottom-0 border-t border-[var(--border)] z-40"
          style={{ background: "rgba(6,9,16,0.95)", backdropFilter: "blur(20px)" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
            <div
              className="flex items-end gap-3 rounded-2xl p-3 transition-all duration-300"
              style={{
                background: "var(--bg-elevated)",
                border: `1px solid ${question ? "rgba(34,211,238,0.4)" : "var(--border)"}`,
                boxShadow: question ? "var(--shadow-cyan)" : undefined,
              }}
            >
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={handleKeyDown}
                disabled={isAnalyzing}
                rows={1}
                placeholder="Ask a question about your data… (⌘K to focus)"
                className="auto-textarea flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] leading-relaxed disabled:opacity-50"
                style={{ fontFamily: "inherit" }}
              />
              {question.length > 0 && (
                <span className={`text-xs flex-shrink-0 font-mono tabular-nums ${charsLeft < 80 ? "text-[var(--amber)]" : "text-[var(--text-muted)]"}`}>
                  {charsLeft}
                </span>
              )}
              <button
                onClick={handleSubmit}
                disabled={!question.trim() || isAnalyzing}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={question.trim() && !isAnalyzing ? {
                  background: "linear-gradient(135deg, var(--cyan), #0ea5e9)",
                  color: "var(--bg-base)",
                  boxShadow: "var(--shadow-cyan)",
                } : { background: "var(--bg-overlay)", color: "var(--text-muted)" }}
              >
                <Send size={15} />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-[11px] text-[var(--text-muted)]">↵ Send · ⇧↵ New line · ⌘K Focus</p>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Sandboxed · Session <span className="text-[var(--cyan)]/60">{sessionId.slice(0, 6)}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
