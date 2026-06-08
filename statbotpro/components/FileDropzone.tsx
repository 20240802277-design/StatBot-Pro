"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileSpreadsheet, X, AlertCircle } from "lucide-react";
import type { DatasetInfo } from "@/types";

interface Props {
  onFileAccepted: (file: File, info: DatasetInfo) => void;
  onPreview: (file: File) => Promise<DatasetInfo>;
  isLoading: boolean;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropzone({ onFileAccepted, onPreview, isLoading }: Props) {
  const [isParsing, setIsParsing] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      const file = accepted[0];
      setError(null);
      setIsParsing(true);
      try {
        const info = await onPreview(file);
        setCurrentFile(file);
        setDatasetInfo(info);
        onFileAccepted(file, info);
      } catch {
        setError("Failed to parse file. Ensure it is a valid UTF-8 CSV.");
      } finally {
        setIsParsing(false);
      }
    },
    [onFileAccepted, onPreview]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv", ".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: isLoading || isParsing,
  });

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentFile(null);
    setDatasetInfo(null);
  };

  const zoneStyle: React.CSSProperties = {
    borderRadius: 16,
    border: `2px dashed ${isDragActive ? "var(--cyan)" : currentFile ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.1)"}`,
    background: isDragActive
      ? "rgba(34,211,238,0.05)"
      : currentFile
      ? "rgba(52,211,153,0.03)"
      : "rgba(255,255,255,0.02)",
    cursor: isLoading || isParsing ? "not-allowed" : "pointer",
    opacity: isLoading || isParsing ? 0.6 : 1,
    transition: "all 0.25s ease",
    transform: isDragActive ? "scale(1.005)" : "scale(1)",
    boxShadow: isDragActive ? "0 0 32px rgba(34,211,238,0.12)" : "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div {...getRootProps()} style={zoneStyle}>
        <input {...getInputProps()} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 24px", textAlign: "center" }}>
          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            border: `1px solid ${isDragActive ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.08)"}`,
            background: isDragActive ? "rgba(34,211,238,0.1)" : "rgba(255,255,255,0.03)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.25s ease",
            transform: isDragActive ? "scale(1.1)" : "scale(1)",
          }}>
            {isParsing
              ? <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(34,211,238,0.2)", borderTopColor: "var(--cyan)", animation: "spin-slow 0.8s linear infinite" }} />
              : <UploadCloud size={22} color={isDragActive ? "var(--cyan)" : "var(--text-muted)"} />
            }
          </div>

          {/* Text */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
              {isParsing ? "Parsing dataset…" : isDragActive ? "Release to upload" : "Drop your CSV or Excel file here"}
            </p>
            {!isParsing && !isDragActive && (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                or{" "}
                <span style={{ color: "var(--cyan)", fontWeight: 500, cursor: "pointer" }}>click to browse</span>
                {" "}· up to 50 MB
              </p>
            )}
          </div>
        </div>
      </div>

      {/* File info card */}
      {currentFile && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", borderRadius: 12,
          border: "1px solid rgba(52,211,153,0.2)",
          background: "rgba(52,211,153,0.04)",
        }} className="animate-fade-up">
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileSpreadsheet size={16} color="var(--cyan)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentFile.name}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
              {datasetInfo ? `${datasetInfo.rows.toLocaleString()} rows · ` : ""}{formatBytes(currentFile.size)}
            </p>
          </div>
          <button onClick={removeFile} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--rose)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--rose)" }}>
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}
