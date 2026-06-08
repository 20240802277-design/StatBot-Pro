export interface DatasetInfo {
  filename: string;
  rows: number;
  columns: number;
  columnNames: string[];
  preview: Record<string, unknown>[];
  dtypes: Record<string, string>;
  missingCells?: number;
  duplicateRows?: number;
}

export interface ChartData {
  type?: "image" | "plotly";
  data?: string; // base64 image or JSON string for plotly
  title?: string;
  url?: string;
  filename?: string;
}

export interface AnalysisResponse {
  session_id: string;
  status: "success" | "error";
  question: string;
  answer?: string;
  code?: string;
  code_executed?: string; // Week 1 compatibility
  charts: ChartData[];
  iterations: number;
  error?: string;
  processing_time_ms?: number;
  execution_time_ms?: number; // Week 1 compatibility
}

export interface AnalysisHistoryItem {
  id: string;
  question: string;
  response: AnalysisResponse;
  timestamp: Date;
}
