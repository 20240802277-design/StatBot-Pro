"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Github, Cpu } from "lucide-react";
import toast from "react-hot-toast";
import FileDropzone from "@/components/FileDropzone";
import AgentThinking from "@/components/AgentThinking";
import AnalysisResult from "@/components/AnalysisResult";
import DataPreview from "@/components/DataPreview";
import { analyzeCSV, previewDataset } from "@/lib/api";
import type { DatasetInfo, AnalysisResponse, AnalysisHistoryItem } from "@/types";

const EXAMPLE_QUESTIONS = [
  "What is the sales trend per region over time?",
  "Which product category has the highest revenue?",
  "Show me a correlation heatmap of all numeric columns.",
  "What are the top 10 customers by total spend?",
  "Are there any outliers in the data? Plot them.",
];

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [question, setQuestion] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isAnalyzing]);

  const handleFileAccepted = (f: File, info: DatasetInfo) => {
    setFile(f);
    setDatasetInfo(info);
    toast.success(`Loaded ${info.rows.toLocaleString()} rows × ${info.columns} columns`);
  };

  const handleSubmit = async () => {
    if (!file || !question.trim()) return;
    if (isAnalyzing) return;

    const q = question.trim();
    setQuestion("");
    setIsAnalyzing(true);

    try {
      const response = await analyzeCSV(file, q, sessionId);
      const item: AnalysisHistoryItem = {
        id: Math.random().toString(36).slice(2),
        question: q,
        response,
        timestamp: new Date(),
      };
      setHistory((h) => [...h, item]);

      if (response.status === "error") {
        toast.error("Agent encountered an error.");
      } else {
        toast.success("Analysis complete!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      toast.error(msg);
      const errItem: AnalysisHistoryItem = {
        id: Math.random().toString(36).slice(2),
        question: q,
        response: {
          session_id: sessionId,
          status: "error",
          question: q,
          charts: [],
          iterations: 0,
          error: msg,
        },
        timestamp: new Date(),
      };
      setHistory((h) => [...h, errItem]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-ink-border bg-ink-soft/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ink-mid border border-cyan-dim flex items-center justify-center">
              <Cpu size={16} className="text-cyan-glow" />
            </div>
            <span className="font-display text-sm text-text">
              StatBot<span className="text-cyan-glow">Pro</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted font-display">
              <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
              LangChain Agent
            </span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-text-muted hover:text-text transition-colors"
            >
              <Github size={16} />
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {/* ── Hero ── */}
        {history.length === 0 && !isAnalyzing && (
          <div className="text-center pt-8 pb-4 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-dim/40 bg-cyan-glow/5 text-xs font-display text-cyan-soft mb-6">
              <Sparkles size={11} />
              Autonomous Data Analyst Agent
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-text leading-tight mb-3">
              Ask anything about<br />
              <span className="text-cyan-glow">your CSV data</span>
            </h1>
            <p className="text-text-muted text-sm max-w-md mx-auto">
              Upload a spreadsheet, ask complex analytical questions in plain English.
              The AI writes pandas code, executes it safely, and returns answers with charts.
            </p>
          </div>
        )}

        {/* ── File Upload ── */}
        <section>
          <FileDropzone
            onFileAccepted={handleFileAccepted}
            onPreview={previewDataset}
            isLoading={isAnalyzing}
          />
        </section>

        {/* ── Dataset Preview ── */}
        {datasetInfo && <DataPreview info={datasetInfo} />}

        {/* ── Conversation History ── */}
        {history.length > 0 && (
          <section className="space-y-6">
            {history.map((item) => (
              <div key={item.id} className="space-y-3">
                {/* User question bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-cyan-glow/10 border border-cyan-dim/40 rounded-xl px-4 py-3">
                    <p className="text-sm text-text">{item.question}</p>
                    <p className="text-xs text-text-muted mt-1 font-display">
                      {item.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                {/* Agent response */}
                <AnalysisResult result={item.response} />
              </div>
            ))}
          </section>
        )}

        {/* ── Agent Thinking ── */}
        {isAnalyzing && <AgentThinking />}

        {/* ── Example Questions (no history) ── */}
        {history.length === 0 && !isAnalyzing && datasetInfo && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted font-display uppercase tracking-widest">
              Try asking
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="px-3 py-1.5 rounded-lg border border-ink-border bg-ink-soft text-xs text-text-muted hover:text-text hover:border-cyan-dim transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Input Bar ── */}
      {datasetInfo && (
        <div className="sticky bottom-0 border-t border-ink-border bg-ink-soft/90 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
            <div
              className={`flex items-end gap-3 border rounded-xl p-3 transition-all duration-300 ${
                question
                  ? "border-cyan-dim shadow-cyan"
                  : "border-ink-border"
              } bg-ink-mid`}
            >
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isAnalyzing}
                rows={1}
                placeholder="Ask a question about your data... (Enter to send)"
                className="flex-1 bg-transparent resize-none outline-none text-sm text-text placeholder:text-text-muted font-body leading-relaxed max-h-32 overflow-y-auto disabled:opacity-50"
                style={{ minHeight: "24px" }}
              />
              <button
                onClick={handleSubmit}
                disabled={!question.trim() || isAnalyzing}
                className={`
                  flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200
                  ${question.trim() && !isAnalyzing
                    ? "bg-cyan-glow text-ink hover:bg-cyan-soft shadow-cyan"
                    : "bg-ink-border text-text-muted cursor-not-allowed"
                  }
                `}
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-xs text-text-muted mt-2 text-center font-display">
              Code runs in a sandboxed environment · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
