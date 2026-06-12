"use client";

import { useState } from "react";
import {
  Bot, Code2, ChevronDown, ChevronUp, AlertCircle, BarChart2,
  Copy, CheckCheck, RefreshCw, ExternalLink,
} from "lucide-react";
import type { AnalysisResponse } from "@/types";

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="text-[var(--text-primary)] font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="text-[var(--cyan)] bg-[var(--cyan-glow)] px-1.5 py-0.5 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) return <h3 key={i} className="text-sm font-bold text-[var(--text-primary)] mt-3 mb-1">{line.slice(3)}</h3>;
    if (line.startsWith("# "))  return <h2 key={i} className="text-base font-bold text-[var(--text-primary)] mt-3 mb-1">{line.slice(2)}</h2>;
    if (line.match(/^[-*] /)) return (
      <li key={i} className="flex items-start gap-2 text-[var(--text-secondary)] ml-2 list-none">
        <span className="mt-2 w-1 h-1 rounded-full bg-[var(--cyan)] flex-shrink-0 block" />
        <span>{renderInline(line.slice(2))}</span>
      </li>
    );
    if (line.match(/^\d+\. /)) {
      const dot = line.indexOf(". ");
      return <p key={i} className="text-[var(--text-secondary)] ml-2"><span className="text-[var(--cyan)] font-mono mr-1.5">{line.slice(0, dot)}.</span>{renderInline(line.slice(dot + 2))}</p>;
    }
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i} className="text-[var(--text-secondary)] leading-relaxed">{renderInline(line)}</p>;
  });
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-all">
      {copied ? <CheckCheck size={11} className="text-[var(--emerald)]" /> : <Copy size={11} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

const downloadChart = (base64Data: string, filename: string, format: "png" | "jpg") => {
  const img = new Image();
  img.src = `data:image/png;base64,${base64Data}`;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const mime = format === "png" ? "image/png" : "image/jpeg";
    const dataUrl = canvas.toDataURL(mime, 0.95);
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${filename}.${format}`;
    link.click();
  };
};

const downloadAsTxt = (text: string, filename: string) => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

const downloadAsPdf = (question: string, answer: string) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>StatBot Pro Analysis Report</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            color: #111827;
            line-height: 1.6;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
          }
          .header {
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
            color: #060910;
          }
          .meta {
            font-size: 12px;
            color: #6b7280;
            margin-top: 5px;
          }
          .section-title {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #4b5563;
            margin-top: 25px;
            font-weight: 700;
          }
          .question {
            font-size: 16px;
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
            border-left: 4px solid #22d3ee;
          }
          .answer {
            font-size: 15px;
            white-space: pre-wrap;
            margin-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">StatBot Pro Analysis Report</div>
          <div class="meta">Generated on ${new Date().toLocaleString()}</div>
        </div>
        <div class="section-title">Question</div>
        <div class="question">${question}</div>
        <div class="section-title">Analysis Result</div>
        <div class="answer">${answer}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};

export default function AnalysisResult({ result }: { result: AnalysisResponse }) {
  const [showCode, setShowCode] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  if (result.status === "error") {
    return (
      <div className="flex items-start gap-3 animate-fade-up">
        <div className="w-9 h-9 rounded-xl bg-[var(--rose)]/10 border border-[var(--rose)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertCircle size={16} className="text-[var(--rose)]" />
        </div>
        <div className="flex-1 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.04)" }}>
          <div className="px-4 py-2.5 border-b border-[var(--rose)]/10 flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--rose)]">Analysis Error</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-[var(--text-secondary)]">{result.error || "An unknown error occurred."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-start gap-3 animate-fade-up">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: "linear-gradient(135deg,rgba(34,211,238,.15),rgba(167,139,250,.15))", border: "1px solid rgba(34,211,238,.25)" }}>
          <Bot size={16} className="text-[var(--cyan)]" />
        </div>

        <div className="flex-1 space-y-3">
          {/* Answer */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]"
              style={{ background: "rgba(34,211,238,0.03)" }}>
              <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-widest">StatBot Analysis</span>
              {result.answer && (
                <div className="flex items-center gap-2">
                  <CopyBtn text={result.answer} />
                  <span className="text-[var(--text-muted)] text-[10px]">·</span>
                  <button onClick={() => downloadAsPdf(result.question, result.answer || "")}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                    PDF
                  </button>
                  <span className="text-[var(--text-muted)] text-[10px]">·</span>
                  <button onClick={() => downloadAsTxt(result.answer || "", "statbot-analysis")}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                    TXT
                  </button>
                </div>
              )}
            </div>
            <div className="px-4 py-4 text-sm space-y-1 leading-relaxed">
              {result.answer ? renderMarkdown(result.answer) : <p className="text-[var(--text-muted)] italic">No answer returned.</p>}
            </div>
            {result.iterations > 0 && (
              <div className="px-4 pb-3">
                <span className="badge text-[var(--text-muted)] bg-[var(--bg-overlay)] border border-[var(--border)]">
                  <RefreshCw size={9} /> {result.iterations} iteration{result.iterations !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Charts */}
          {result.charts?.length > 0 && result.charts.map((chart, i) => {
            const isUrl = !!chart.url;
            const chartSrc = chart.url || (chart.data ? `data:image/png;base64,${chart.data}` : "");
            if (!chartSrc) return null;
            return (
              <div key={i} className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={13} className="text-[var(--violet)]" />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">{chart.title || `Chart ${i + 1}`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isUrl ? (
                      <a href={chart.url} download={chart.title || `chart-${i + 1}.png`}
                        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all">
                        Download
                      </a>
                    ) : (
                      <>
                        <button onClick={() => downloadChart(chart.data || "", chart.title || `chart-${i + 1}`, "png")}
                          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all">
                          PNG
                        </button>
                        <span className="text-[var(--text-muted)] text-[10px]">·</span>
                        <button onClick={() => downloadChart(chart.data || "", chart.title || `chart-${i + 1}`, "jpg")}
                          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all">
                          JPG
                        </button>
                      </>
                    )}
                    <span className="text-[var(--text-muted)] text-[10px]">·</span>
                    <button onClick={() => setLightboxImg(chartSrc)}
                      className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                      <ExternalLink size={11} /> Expand
                    </button>
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={chartSrc} alt={chart.title || `Chart ${i + 1}`}
                  className="w-full cursor-zoom-in hover:brightness-105 transition-all"
                  onClick={() => setLightboxImg(chartSrc)} />
              </div>
            );
          })}

          {/* Code */}
          {(result.code || result.code_executed) && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button onClick={() => setShowCode((s) => !s)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/3 transition-colors"
                style={{ background: "var(--bg-elevated)" }}>
                <Code2 size={13} className="text-[var(--violet)]" />
                <span className="text-xs text-[var(--text-secondary)] flex-1">View generated pandas code</span>
                <span className="badge text-[var(--text-muted)] bg-[var(--bg-overlay)] border border-[var(--border)] mr-1">Python</span>
                {showCode ? <ChevronUp size={13} className="text-[var(--text-muted)]" /> : <ChevronDown size={13} className="text-[var(--text-muted)]" />}
              </button>
              {showCode && (
                <div className="relative">
                  <div className="absolute top-2 right-2 z-10"><CopyBtn text={result.code || result.code_executed || ""} /></div>
                  <pre className="code-block !rounded-none !border-0 !border-t border-[var(--border)]"><code>{result.code || result.code_executed}</code></pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setLightboxImg(null)}>
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxImg} alt="Chart" className="max-w-full max-h-[85vh] object-contain" />
            <button onClick={() => setLightboxImg(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">✕</button>
          </div>
        </div>
      )}
    </>
  );
}
