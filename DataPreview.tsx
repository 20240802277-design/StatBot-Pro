"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Database, Hash, Calendar, Type, HelpCircle } from "lucide-react";
import type { DatasetInfo } from "@/types";

const DTYPE_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  number:   { label: "num",  color: "var(--violet)",   Icon: Hash       },
  datetime: { label: "date", color: "var(--amber)",    Icon: Calendar   },
  string:   { label: "str",  color: "var(--emerald)",  Icon: Type       },
  unknown:  { label: "?",    color: "var(--text-muted)", Icon: HelpCircle },
};

export default function DataPreview({ info }: { info: DatasetInfo }) {
  const [expanded, setExpanded] = useState(false);

  const numericCount  = Object.values(info.dtypes).filter(d => d === "number").length;
  const datetimeCount = Object.values(info.dtypes).filter(d => d === "datetime").length;
  const stringCount   = Object.values(info.dtypes).filter(d => d === "string").length;

  const cardStyle: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid var(--border-bright)",
    background: "var(--bg-elevated)",
    overflow: "hidden",
  };

  const statCard = (label: string, value: string | number, color?: string) => (
    <div key={label} style={{
      padding: "12px 14px", borderRadius: 12,
      border: "1px solid var(--border)",
      background: "rgba(255,255,255,0.02)",
    }}>
      <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: color || "var(--text-primary)", lineHeight: 1 }}>{value}</p>
    </div>
  );

  return (
    <div style={cardStyle} className="animate-fade-up">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
        onMouseLeave={e => e.currentTarget.style.background = "none"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Database size={14} color="var(--violet)" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{info.filename}</p>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>
              {info.rows.toLocaleString()} rows · {info.columns} columns
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* dtype pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {numericCount > 0 && (
              <span className="badge" style={{ color: "var(--violet)", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <Hash size={9} /> {numericCount}
              </span>
            )}
            {datetimeCount > 0 && (
              <span className="badge" style={{ color: "var(--amber)", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <Calendar size={9} /> {datetimeCount}
              </span>
            )}
            {stringCount > 0 && (
              <span className="badge" style={{ color: "var(--emerald)", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                <Type size={9} /> {stringCount}
              </span>
            )}
          </div>
          {expanded
            ? <ChevronUp size={15} color="var(--text-muted)" />
            : <ChevronDown size={15} color="var(--text-muted)" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {statCard("Total Rows", info.rows.toLocaleString())}
            {statCard("Columns", info.columns)}
            {statCard("Missing Cells", info.missingCells?.toLocaleString() ?? 0, info.missingCells ? "var(--amber)" : "var(--emerald)")}
            {statCard("Duplicate Rows", info.duplicateRows?.toLocaleString() ?? 0, info.duplicateRows ? "var(--rose)" : "var(--emerald)")}
          </div>

          {/* Column chips */}
          <div>
            <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>Columns</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {info.columnNames.map(col => {
                const dtype = info.dtypes[col] || "unknown";
                const cfg = DTYPE_CONFIG[dtype] || DTYPE_CONFIG.unknown;
                const Icon = cfg.Icon;
                return (
                  <span key={col} className="badge font-mono"
                    style={{ color: cfg.color, background: `${cfg.color}14`, border: `1px solid ${cfg.color}30`, fontSize: 11 }}
                    title={`Type: ${dtype}`}
                  >
                    <Icon size={9} />{col}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Preview table */}
          {info.preview.length > 0 && (
            <div>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>Preview (first {info.preview.length} rows)</p>
              <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)", maxHeight: 260, overflowY: "auto" }}>
                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-overlay)", position: "sticky", top: 0, zIndex: 1 }}>
                      {info.columnNames.map(col => (
                        <th key={col} style={{
                          padding: "8px 12px", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap",
                          color: "var(--text-secondary)", borderBottom: "1px solid var(--border)",
                        }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {info.preview.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}
                      >
                        {info.columnNames.map(col => (
                          <td key={col} style={{
                            padding: "7px 12px", whiteSpace: "nowrap",
                            maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis",
                            color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace",
                          }}>{String(row[col] ?? "—")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
