import type { DatasetInfo, AnalysisResponse } from "@/types";
import Papa from "papaparse";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Smarter dtype detection ──────────────────────────────────────
function detectDtype(values: unknown[]): string {
  const nonEmpty = values.filter((v) => v !== "" && v != null && String(v).trim() !== "");
  if (nonEmpty.length === 0) return "unknown";

  let numericCount = 0;
  let dateCount = 0;

  for (const v of nonEmpty) {
    const s = String(v).trim();

    // Phone numbers / long digit strings → string (not number)
    if (/^\d{7,}(\.\d+)?$/.test(s)) {
      // Likely phone number or ID — treat as string
      continue;
    }

    if (!isNaN(Number(s)) && s !== "") {
      numericCount++;
    } else if (!isNaN(Date.parse(s)) && /\d{4}/.test(s)) {
      // Must contain a 4-digit year to be a real date
      dateCount++;
    }
  }

  const ratio = nonEmpty.length;
  if (numericCount / ratio > 0.8) return "number";
  if (dateCount / ratio > 0.8) return "datetime";
  return "string";
}

// ── Preview dataset — parses ALL rows for correct count ──────────
export async function previewDataset(file: File): Promise<DatasetInfo> {
  return new Promise((resolve, reject) => {
    // First pass: parse ALL rows to get true count + dtypes
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      // No preview limit — read everything
      complete: (results) => {
        const allRows = results.data as Record<string, unknown>[];
        const columnNames = results.meta.fields || [];

        if (columnNames.length === 0) {
          reject(new Error("No columns found. Is this a valid CSV?"));
          return;
        }

        // Detect dtype from all values for each column
        const dtypes: Record<string, string> = {};
        columnNames.forEach((col) => {
          const colValues = allRows.map((r) => r[col]);
          dtypes[col] = detectDtype(colValues);
        });

        // Clean preview rows — trim strings, handle floats
        const previewRows = allRows.slice(0, 8).map((row) => {
          const cleaned: Record<string, unknown> = {};
          for (const col of columnNames) {
            const val = row[col];
            if (val === null || val === undefined || val === "") {
              cleaned[col] = "—";
            } else {
              const s = String(val).trim();
              // Remove trailing .0 from phone numbers shown in table
              cleaned[col] = /^\d+\.0$/.test(s) ? s.replace(/\.0$/, "") : s;
            }
          }
          return cleaned;
        });

        // Calculate missing values and duplicates count client-side
        let missingCells = 0;
        allRows.forEach((row) => {
          columnNames.forEach((col) => {
            const val = row[col];
            if (val === null || val === undefined || String(val).trim() === "") {
              missingCells++;
            }
          });
        });

        const rowStrings = allRows.map((row) => JSON.stringify(row));
        const uniqueRowStrings = new Set(rowStrings);
        const duplicateRows = rowStrings.length - uniqueRowStrings.size;

        resolve({
          filename: file.name,
          rows: allRows.length,
          columns: columnNames.length,
          columnNames,
          preview: previewRows,
          dtypes,
          missingCells,
          duplicateRows,
        });
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}

// ── Analyze CSV synchronously (Week 1) ───────────────────────────
export async function analyzeCSV(
  file: File,
  question: string,
  sessionId: string
): Promise<AnalysisResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("question", question);
    formData.append("session_id", sessionId);

    const res = await fetch(`${API_BASE}/api/analysis/upload-and-ask`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Analysis failed" }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("Analysis error:", err);
    
    // ── Local Fallback (Demo Mode) ──
    const info = await previewDataset(file).catch(() => null);
    const summaryText = info 
      ? `- \`${info.filename}\` (${info.rows} rows × ${info.columns} cols)` 
      : `- \`${file.name}\``;

    const answer = [
      `**Demo Mode** — Backend not connected or encountered an error.`,
      ``,
      `**Your question:** *"${question}"*`,
      ``,
      `**Spreadsheet loaded:**`,
      summaryText,
      ``,
      `**To enable live AI analysis:**`,
      `1. Ensure the FastAPI backend is running on port 8000`,
      `2. Supply your \`OPENAI_API_KEY\` in \`backend/.env\``,
      `3. Submit your question again`,
    ].join("\n");

    const code = [
      `import pandas as pd`,
      `df = pd.read_csv("${file.name}")`,
      `# df.head()`,
    ].join("\n");

    return {
      session_id: sessionId,
      status: "success",
      question,
      answer,
      code_executed: code,
      charts: [],
      iterations: 1,
    };
  }
}
