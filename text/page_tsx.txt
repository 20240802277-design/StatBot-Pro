"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Cpu, Zap } from "lucide-react";
import toast from "react-hot-toast";
import FileDropzone from "@/components/FileDropzone";
import AgentThinking from "@/components/AgentThinking";
import AnalysisResult from "@/components/AnalysisResult";
import DataPreview from "@/components/DataPreview";
import { analyzeCSV, previewDataset } from "@/lib/api";
import type { DatasetInfo, AnalysisResponse, AnalysisHistoryItem } from "@/types";

const EXAMPLE_QUESTIONS = [
  "What are the top 5 rows by highest value?",
  "Show a bar chart of the most frequent categories.",
  "What is the correlation between numeric columns?",
  "Are there any outliers? Plot them.",
  "Summarise the dataset statistics.",
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
    toast.success(`✓ Loaded ${info.rows.toLocaleString()} rows × ${info.columns} cols`, {
      style: { background: "#0f1623", color: "#f0f6ff", border: "1px solid rgba(52,211,153,0.3)" },
    });
  };

  const handleSubmit = async () => {
    if (!file || !question.trim() || isAnalyzing) return;
    const q = question.trim();
    setQuestion("");
    setIsAnalyzing(true);

    try {
      const response = await analyzeCSV(file, q, sessionId);
      setHistory((h) => [...h, {
        id: Math.random().toString(36).slice(2),
        question: q, response,
        timestamp: new Date(),
      }]);
      if (response.status === "error") {
        toast.error("Agent error", { style: { background: "#0f1623", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" } });
      } else {
        toast.success("Analysis complete!", { style: { background: "#0f1623", color: "#f0f6ff", border: "1px solid rgba(34,211,238,0.3)" } });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      toast.error(msg);
      setHistory((h) => [...h, {
        id: Math.random().toString(36).slice(2),
        question: q,
        response: { session_id: sessionId, status: "error", question: q, charts: [], iterations: 0, error: msg },
        timestamp: new Date(),
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-base)" }} className="grid-bg">

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: "1px solid var(--border)",
        background: "rgba(5,8,15,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(167,139,250,0.2))",
              border: "1px solid rgba(34,211,238,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 16px rgba(34,211,238,0.15)",
            }}>
              <Cpu size={15} color="var(--cyan)" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              StatBot<span style={{ color: "var(--cyan)" }}>Pro</span>
            </span>
          </div>

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--emerald)", boxShadow: "0 0 6px var(--emerald)" }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>LangChain Agent</span>
            </div>
            <a href="https://github.com" target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
            >GitHub</a>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, maxWidth: 860, width: "100%", margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Hero (shown when no history) ── */}
        {history.length === 0 && !isAnalyzing && (
          <div className="animate-fade-in" style={{ textAlign: "center", paddingTop: 24, paddingBottom: 8 }}>
            {/* Pill badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 14px", borderRadius: 99,
              border: "1px solid rgba(34,211,238,0.2)",
              background: "rgba(34,211,238,0.05)",
              color: "var(--cyan)", fontSize: 11, fontWeight: 500, marginBottom: 20,
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              <Sparkles size={10} />
              Autonomous Data Analyst Agent
            </div>

            <h1 style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.2, marginBottom: 14, letterSpacing: "-0.03em" }}>
              Ask anything about<br />
              <span className="gradient-text">your CSV data</span>
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>
              Upload a spreadsheet, ask complex analytical questions in plain English.
              The AI writes pandas code, runs it safely, and returns answers with charts.
            </p>

            {/* Feature pills */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 24 }}>
              {["📊 Auto Charts", "🔁 Self-Correcting", "🔒 Sandboxed Execution", "⚡ Instant Results"].map(f => (
                <span key={f} style={{
                  padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 500,
                  border: "1px solid var(--border-bright)",
                  background: "rgba(255,255,255,0.03)",
                  color: "var(--text-secondary)",
                }}>{f}</span>
              ))}
            </div>
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

        {/* ── Example Questions ── */}
        {history.length === 0 && !isAnalyzing && datasetInfo && (
          <div className="animate-fade-up">
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Try asking
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXAMPLE_QUESTIONS.map((q) => (
                <button key={q} onClick={() => { setQuestion(q); textareaRef.current?.focus(); }}
                  style={{
                    padding: "6px 14px", borderRadius: 99, fontSize: 12,
                    border: "1px solid var(--border-bright)",
                    background: "rgba(255,255,255,0.025)",
                    color: "var(--text-secondary)", cursor: "pointer",
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.35)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "rgba(34,211,238,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
                >{q}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Conversation History ── */}
        {history.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {history.map((item) => (
              <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* User bubble */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{
                    maxWidth: "78%",
                    background: "rgba(34,211,238,0.08)",
                    border: "1px solid rgba(34,211,238,0.2)",
                    borderRadius: "16px 16px 4px 16px",
                    padding: "10px 16px",
                  }}>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>{item.question}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
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

        <div ref={bottomRef} />
      </main>

      {/* ── Input Bar ── */}
      {datasetInfo && (
        <div style={{
          position: "sticky", bottom: 0, zIndex: 40,
          borderTop: "1px solid var(--border)",
          background: "rgba(5,8,15,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 24px" }}>
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 10,
              border: question ? "1px solid rgba(34,211,238,0.35)" : "1px solid var(--border-bright)",
              borderRadius: 16,
              background: "var(--bg-elevated)",
              padding: "10px 14px",
              boxShadow: question ? "0 0 20px rgba(34,211,238,0.08)" : "none",
              transition: "all 0.2s ease",
            }}>
              <div style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
                <Zap size={14} color={question ? "var(--cyan)" : "var(--text-muted)"} style={{ transition: "all 0.2s" }} />
              </div>
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isAnalyzing}
                rows={1}
                placeholder="Ask a question about your data… (Enter to send)"
                className="auto-textarea"
                style={{ flex: 1, fontSize: 13, lineHeight: 1.6, opacity: isAnalyzing ? 0.5 : 1 }}
              />
              <button
                onClick={handleSubmit}
                disabled={!question.trim() || isAnalyzing}
                style={{
                  flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: question.trim() && !isAnalyzing
                    ? "linear-gradient(135deg, var(--cyan), rgba(167,139,250,0.8))"
                    : "rgba(255,255,255,0.05)",
                  border: "none", cursor: question.trim() && !isAnalyzing ? "pointer" : "not-allowed",
                  boxShadow: question.trim() && !isAnalyzing ? "0 0 16px rgba(34,211,238,0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <Send size={14} color={question.trim() && !isAnalyzing ? "#05080f" : "var(--text-muted)"} />
              </button>
            </div>
            <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
              Code runs in a sandboxed environment · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
