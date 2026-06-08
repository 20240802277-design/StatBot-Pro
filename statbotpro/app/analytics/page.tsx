"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart2, FileText, Database, ArrowLeft, Download, Plus,
  LineChart, PieChart, RefreshCw, Cpu, Sparkles, Sliders, Info,
  TrendingUp, DollarSign, List, Columns
} from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";
import toast, { Toaster } from "react-hot-toast";

interface DataRow {
  [key: string]: any;
}

const SAMPLE_DATA: DataRow[] = [
  { Month: "Jan", Sales: 4200, Profit: 1200, Category: "Electronics", CustomerCount: 120 },
  { Month: "Feb", Sales: 5100, Profit: 1800, Category: "Electronics", CustomerCount: 150 },
  { Month: "Mar", Sales: 6200, Profit: 2300, Category: "Furniture", CustomerCount: 180 },
  { Month: "Apr", Sales: 7800, Profit: 3100, Category: "Office Supplies", CustomerCount: 220 },
  { Month: "May", Sales: 8300, Profit: 3500, Category: "Office Supplies", CustomerCount: 240 },
  { Month: "Jun", Sales: 9500, Profit: 4200, Category: "Electronics", CustomerCount: 310 },
  { Month: "Jul", Sales: 11000, Profit: 5200, Category: "Furniture", CustomerCount: 380 },
  { Month: "Aug", Sales: 10500, Profit: 4900, Category: "Electronics", CustomerCount: 360 },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<DataRow[]>(SAMPLE_DATA);
  const [filename, setFilename] = useState("sample_monthly_sales.csv");
  const [xAxis, setXAxis] = useState("Month");
  const [yAxis, setYAxis] = useState("Sales");
  const [chartType, setChartType] = useState<"bar" | "line" | "scatter">("bar");
  const [colorTheme, setColorTheme] = useState<"cyan" | "violet" | "emerald">("cyan");

  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  const numericColumns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).filter((col) => {
      return data.some((row) => !isNaN(Number(row[col])) && row[col] !== "");
    });
  }, [data]);

  // If columns change, pick sensible defaults
  useEffect(() => {
    if (columns.length > 0 && !columns.includes(xAxis)) {
      setXAxis(columns[0]);
    }
    if (numericColumns.length > 0 && !numericColumns.includes(yAxis)) {
      setYAxis(numericColumns[0]);
    }
  }, [columns, numericColumns, xAxis, yAxis]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as DataRow[];
        if (rows.length > 0) {
          setData(rows);
          toast.success(`Loaded ${rows.length} rows successfully!`);
        } else {
          toast.error("No valid rows found in the CSV");
        }
      },
      error: (err) => {
        toast.error(`Error parsing file: ${err.message}`);
      }
    });
  };

  // Metrics
  const summaryMetrics = useMemo(() => {
    if (!data || data.length === 0 || !yAxis) return { total: 0, avg: 0, max: 0 };
    const vals = data.map((r) => Number(r[yAxis])).filter((v) => !isNaN(v));
    if (vals.length === 0) return { total: 0, avg: 0, max: 0 };
    const total = vals.reduce((a, b) => a + b, 0);
    return {
      total,
      avg: total / vals.length,
      max: Math.max(...vals),
    };
  }, [data, yAxis]);

  // Chart Rendering calculations
  const chartData = useMemo(() => {
    if (!data || !xAxis || !yAxis) return [];
    return data.slice(0, 15).map((row) => ({
      label: String(row[xAxis] ?? ""),
      value: Number(row[yAxis] ?? 0),
    }));
  }, [data, xAxis, yAxis]);

  const maxValue = useMemo(() => {
    const vals = chartData.map((d) => d.value);
    return Math.max(...vals, 1);
  }, [chartData]);

  // Column Profiler
  const columnProfiles = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).map((col) => {
      const vals = data.map((r) => r[col]);
      const nulls = vals.filter((v) => v === null || v === undefined || v === "").length;
      const isNum = vals.every((v) => v === "" || v === null || !isNaN(Number(v)));
      const unique = new Set(vals).size;
      return {
        name: col,
        type: isNum ? "number" : "string",
        nulls,
        unique,
      };
    });
  }, [data]);

  const activeColor = {
    cyan: "var(--cyan)",
    violet: "var(--violet)",
    emerald: "var(--emerald)",
  }[colorTheme];

  const activeColorDim = {
    cyan: "rgba(34, 211, 238, 0.15)",
    violet: "rgba(167, 139, 250, 0.15)",
    emerald: "rgba(52, 211, 153, 0.15)",
  }[colorTheme];

  return (
    <div className="min-h-dvh grid-bg flex flex-col" style={{ background: "var(--bg-base)" }}>
      <Toaster position="top-right" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)]"
        style={{ background: "rgba(6,9,16,0.85)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(34,211,238,.2),rgba(167,139,250,.2))", border: "1px solid rgba(34,211,238,.3)" }}>
                <Cpu size={16} className="text-[var(--cyan)]" />
              </div>
              <span className="font-extrabold text-base sm:text-lg tracking-tight">
                StatBot<span className="gradient-text">Pro</span>
              </span>
            </Link>
            <span className="text-[var(--border-bright)] hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-1.5 bg-white/5 px-1.5 py-1 rounded-xl border border-[var(--border)]">
              <Link href="/" className="text-xs px-3 py-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                AI Agent Chat
              </Link>
              <span className="text-xs px-3 py-1 rounded-lg font-semibold bg-[var(--bg-overlay)] text-[var(--cyan)] border border-white/5 transition-all">
                BI Workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-white/5 hover:bg-white/10 transition-all cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <Plus size={12} /> Upload CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <Link href="/" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[var(--cyan)]/30 bg-[var(--cyan-glow)] text-[var(--cyan)] hover:bg-[var(--cyan-dim)] transition-all">
              <ArrowLeft size={12} /> Back to AI
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-6 space-y-6">
        
        {/* Workspace Title & Stats Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-[var(--border)]"
          style={{ background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))" }}>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider text-[var(--violet)] bg-[var(--violet-dim)] border border-[var(--violet)]/10 uppercase mb-2">
              Interactive Analytics
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">BI Dashboard Sandbox</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Active File: <code className="text-[var(--cyan)]">{filename}</code> ({data.length} rows loaded)
            </p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 md:w-auto">
            <div className="px-4 py-2 bg-white/3 rounded-xl border border-[var(--border)] text-center min-w-[100px]">
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Total {yAxis}</p>
              <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                {summaryMetrics.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="px-4 py-2 bg-white/3 rounded-xl border border-[var(--border)] text-center min-w-[100px]">
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Avg {yAxis}</p>
              <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                {summaryMetrics.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="px-4 py-2 bg-white/3 rounded-xl border border-[var(--border)] text-center min-w-[100px]">
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Max {yAxis}</p>
              <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                {summaryMetrics.max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Controls & Profiler (Left - 4 columns) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Chart Customizer Panel */}
            <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
                <Sliders size={14} className="text-[var(--cyan)]" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-primary)]">Chart Settings</h2>
              </div>

              {/* X Axis */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">X-Axis (Labels)</label>
                <select value={xAxis} onChange={(e) => setXAxis(e.target.value)}
                  className="w-full text-xs bg-[var(--bg-overlay)] border border-[var(--border)] rounded-xl px-3 py-2 outline-none text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-all">
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Y Axis */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">Y-Axis (Numeric Values)</label>
                <select value={yAxis} onChange={(e) => setYAxis(e.target.value)}
                  className="w-full text-xs bg-[var(--bg-overlay)] border border-[var(--border)] rounded-xl px-3 py-2 outline-none text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-all">
                  {numericColumns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Chart Type Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">Chart Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["bar", "line", "scatter"] as const).map((type) => (
                    <button key={type} onClick={() => setChartType(type)}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-semibold border capitalize transition-all flex flex-col items-center gap-1 ${
                        chartType === type
                          ? "border-[var(--cyan)]/40 bg-[var(--cyan-glow)] text-[var(--cyan)]"
                          : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}>
                      {type === "bar" && <BarChart2 size={12} />}
                      {type === "line" && <LineChart size={12} />}
                      {type === "scatter" && <Plus size={12} />}
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Theme Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">Palette</label>
                <div className="flex gap-2">
                  {(["cyan", "violet", "emerald"] as const).map((theme) => (
                    <button key={theme} onClick={() => setColorTheme(theme)}
                      className={`flex-1 py-1 rounded-lg text-[10px] border capitalize font-medium ${
                        colorTheme === theme
                          ? "border-[var(--text-primary)] bg-white/5"
                          : "border-transparent"
                      }`}
                      style={{ color: `var(--${theme})` }}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: `var(--${theme})` }} />
                      {theme}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Column Schema Profiler */}
            <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
                <Columns size={14} className="text-[var(--violet)]" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-primary)]">Data Profiler</h2>
              </div>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {columnProfiles.map((col) => (
                  <div key={col.name} className="flex items-center justify-between p-2 rounded-xl bg-white/2 border border-white/5">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[140px]">{col.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {col.unique} unique values · {col.nulls} nulls
                      </p>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono border"
                      style={{
                        borderColor: col.type === "number" ? "rgba(167,139,250,0.2)" : "rgba(52,211,153,0.2)",
                        background: col.type === "number" ? "rgba(167,139,250,0.05)" : "rgba(52,211,153,0.05)",
                        color: col.type === "number" ? "var(--violet)" : "var(--emerald)"
                      }}>
                      {col.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Chart Display Panel (Right - 8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* The Visualizer Card */}
            <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] flex flex-col h-[400px]">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 size={15} className="text-[var(--cyan)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{yAxis} by {xAxis}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mr-2">Interactive SVG Chart</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--emerald)] animate-pulse" />
                </div>
              </div>

              {/* Dynamic SVG Visualizer Area */}
              <div className="flex-1 flex items-end justify-between gap-2.5 pt-6 px-4 pb-2 border-b border-[var(--border)]/60 relative">
                {chartData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--text-muted)] italic">
                    No displayable chart data
                  </div>
                ) : chartType === "bar" ? (
                  chartData.map((d, i) => {
                    const pct = (d.value / maxValue) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full mb-1 scale-0 group-hover:scale-100 transition-all duration-150 z-20 bg-[var(--bg-overlay)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-[10px] shadow-xl text-[var(--text-primary)] font-mono text-center min-w-[70px] pointer-events-none">
                          <p className="font-semibold text-[var(--text-muted)] truncate max-w-[100px]">{d.label}</p>
                          <p className="font-bold mt-0.5" style={{ color: activeColor }}>{d.value.toLocaleString()}</p>
                        </div>
                        {/* Bar */}
                        <div className="w-full rounded-t-lg transition-all duration-500 hover:brightness-110"
                          style={{
                            height: `${pct}%`,
                            background: `linear-gradient(0deg, ${activeColorDim} 0%, ${activeColor} 100%)`,
                            boxShadow: `0 0 16px ${activeColorDim}`
                          }}
                        />
                      </div>
                    );
                  })
                ) : chartType === "line" ? (
                  // Line SVG overlay
                  <div className="absolute inset-x-8 top-12 bottom-8">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={activeColor} stopOpacity="0.4" />
                          <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Area under the line */}
                      <path
                        d={`M 0 100 ${chartData.map((d, i) => `L ${(i / (chartData.length - 1)) * 100} ${100 - (d.value / maxValue) * 85}`).join(" ")} L 100 100 Z`}
                        fill="url(#lineGrad)"
                        className="transition-all duration-500"
                      />
                      {/* The Line path */}
                      <path
                        d={chartData.map((d, i) => `${i === 0 ? "M" : "L"} ${(i / (chartData.length - 1)) * 100} ${100 - (d.value / maxValue) * 85}`).join(" ")}
                        fill="none"
                        stroke={activeColor}
                        strokeWidth="2.5"
                        className="transition-all duration-500"
                      />
                    </svg>
                    {/* SVG Dots */}
                    <div className="absolute inset-0 flex justify-between">
                      {chartData.map((d, i) => {
                        const pct = (d.value / maxValue) * 85;
                        return (
                          <div key={i} className="absolute flex flex-col items-center group cursor-pointer z-10"
                            style={{
                              left: `${(i / (chartData.length - 1)) * 100}%`,
                              bottom: `${pct}%`,
                              transform: "translate(-50%, 50%)"
                            }}>
                            {/* Dot Tooltip */}
                            <div className="absolute bottom-6 scale-0 group-hover:scale-100 transition-all duration-150 z-20 bg-[var(--bg-overlay)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-[10px] shadow-xl text-[var(--text-primary)] font-mono text-center pointer-events-none min-w-[70px]">
                              <p className="font-semibold text-[var(--text-muted)] truncate max-w-[80px]">{d.label}</p>
                              <p className="font-bold mt-0.5" style={{ color: activeColor }}>{d.value.toLocaleString()}</p>
                            </div>
                            {/* Inner Dot */}
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-elevated)] hover:scale-125 transition-all"
                              style={{ background: activeColor, boxShadow: `0 0 10px ${activeColor}` }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // Scatter Plot
                  <div className="absolute inset-x-8 top-12 bottom-8">
                    {chartData.map((d, i) => {
                      const pctX = (i / (chartData.length - 1)) * 100;
                      const pctY = (d.value / maxValue) * 85;
                      return (
                        <div key={i} className="absolute flex flex-col items-center group cursor-pointer z-10"
                          style={{
                            left: `${pctX}%`,
                            bottom: `${pctY}%`,
                            transform: "translate(-50%, 50%)"
                          }}>
                          {/* Tooltip */}
                          <div className="absolute bottom-6 scale-0 group-hover:scale-100 transition-all duration-150 z-20 bg-[var(--bg-overlay)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-[10px] shadow-xl text-[var(--text-primary)] font-mono text-center pointer-events-none min-w-[70px]">
                            <p className="font-semibold text-[var(--text-muted)] truncate max-w-[80px]">{d.label}</p>
                            <p className="font-bold mt-0.5" style={{ color: activeColor }}>{d.value.toLocaleString()}</p>
                          </div>
                          {/* Scatter Dot */}
                          <div className="w-4 h-4 rounded-full border border-[var(--bg-elevated)] hover:scale-125 transition-all"
                            style={{ background: activeColorDim, borderColor: activeColor, boxShadow: `0 0 8px ${activeColorDim}` }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Labels Row */}
              <div className="flex justify-between px-4 pt-2 text-[9px] text-[var(--text-muted)] font-mono truncate">
                {chartData.map((d, i) => (
                  <span key={i} className="text-center w-12 truncate" title={d.label}>{d.label}</span>
                ))}
              </div>
            </div>

            {/* Quick Insights Summary */}
            <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[var(--cyan)]" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-primary)]">Quick Insights</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                The visualizer is charting the first 15 records. In this dataset, the highest value for <strong className="text-[var(--text-primary)]">{yAxis}</strong> occurs at <strong className="text-[var(--text-primary)]">
                  {chartData.find((d) => d.value === maxValue)?.label || "N/A"}
                </strong> with a value of <strong style={{ color: activeColor }}>
                  {maxValue.toLocaleString()}
                </strong>. The average calculated across the entire dataset is <strong className="text-[var(--text-primary)]">{summaryMetrics.avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>.
              </p>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
