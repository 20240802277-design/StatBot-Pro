<div align="center">

# ⚡ StatBot**Pro**

### ***Your Data Has a Story. Let AI Tell It.***

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![LangChain](https://img.shields.io/badge/LangChain-Agent-1C3C3C?style=for-the-badge&logo=chainlink)](https://langchain.com)
[![GPT-4o](https://img.shields.io/badge/GPT--4o-Powered-412991?style=for-the-badge&logo=openai)](https://openai.com)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-22d3ee?style=for-the-badge)](LICENSE)

<br/>
 
> **Drop any CSV. Ask anything. Get instant answers, charts, and runnable code.**  
> Powered by a self-correcting LangChain agent with a sandboxed Python execution engine.

<br/>

```
┌─────────────────────────────────────────────────────────────┐
│  📂 Upload CSV  →  💬 Ask in English  →  📊 Get Charts + Answers  │
└─────────────────────────────────────────────────────────────┘
```

**[🚀 Quick Start](#-quick-start)** · **[📡 API Docs](#-api-reference)** · **[🛡️ Security](#️-sandboxed-execution)** · **[🗺️ Roadmap](#️-roadmap)**

</div>

---

## ✨ What Makes StatBotPro Different

| Feature | Description |
|---|---|
| 🤖 **Autonomous Agent** | LangChain OpenAI Tools Agent — writes, executes, and self-corrects pandas code in a loop until it gets the right answer |
| 🔒 **Sandboxed REPL** | Executes generated Python in a stripped-down environment — no file system, no network, no escape |
| 📊 **Auto-Charting** | Matplotlib/Seaborn charts are generated on-the-fly and served as static URLs |
| 💬 **Conversational UI** | Full chat history, recent questions sidebar, copy answers, export sessions as JSON |
| ⏱️ **Live Elapsed Timer** | See exactly how long the agent is thinking in real time |
| ⌨️ **Power User Shortcuts** | `⌘K` to focus · `↵` to send · `⇧↵` for newline · 500-char limit with live counter |
| 🗂️ **Dataset Intelligence** | Instant column type detection, numeric/date column chips, missing value awareness |

---

## 🏗️ Architecture #

```
statbot-pro/
│
├── 🐍 backend/                        FastAPI + LangChain Agent
│   ├── main.py                        App entrypoint, CORS, static mounts
│   └── app/
│       ├── routers/
│       │   ├── analysis.py            POST /api/analysis/upload-and-ask
│       │   └── health.py              GET  /api/health
│       ├── services/
│       │   ├── agent.py               LangChain autonomous agent (self-correcting)
│       │   └── file_handler.py        CSV / Excel → pandas DataFrame
│       ├── models/
│       │   └── schemas.py             Pydantic request/response models
│       └── utils/
│           └── sandbox.py             Restricted Python REPL execution engine
│
├── ⚛️  frontend/  (Next.js 16 App Router)
│   ├── app/
│   │   ├── page.tsx                   Main chat UI
│   │   ├── layout.tsx                 Root layout + metadata
│   │   └── globals.css                Tailwind v4 base styles
│   ├── components/
│   │   ├── FileDropzone.tsx           Drag-and-drop upload with client-side preview
│   │   ├── AgentThinking.tsx          Animated skeleton + elapsed timer
│   │   ├── AnalysisResult.tsx         Answer card + chart lightbox + code viewer
│   │   └── DataPreview.tsx            Column table + dtype chips
│   ├── lib/
│   │   └── api.ts                     Typed Axios API client
│   └── types/
│       └── index.ts                   Shared TypeScript interfaces
│
└── 🐳 docker-compose.yml              One command to rule them all
```

---

## 🚀 Quick Start

### ⚡ Option A — Docker Compose *(Recommended)*

```bash
# Clone the repo
git clone https://github.com/your-org/statbot-pro.git
cd statbot-pro

# Add your OpenAI key
echo "OPENAI_API_KEY=sk-..." > .env

# Launch the full stack
docker-compose up --build
```

> 🌐 App → **http://localhost:3000** · 📖 API Docs → **http://localhost:8000/docs**

---

### 🛠️ Option B — Local Development

**1. Backend**
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# → Open .env and paste your OPENAI_API_KEY

# Start the server
uvicorn main:app --reload --port 8000
```

**2. Frontend**
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# → NEXT_PUBLIC_API_URL=http://localhost:8000 (already set)

# Start dev server
npm run dev
```

---

## 🔑 Environment Variables

### Backend — `backend/.env`

| Variable | Default | Required | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | — | ✅ Yes | Your OpenAI secret key |
| `OPENAI_MODEL` | `gpt-4o` | No | Model to power the agent |
| `MAX_ITERATIONS` | `10` | No | Max self-correction retries per query |
| `CHARTS_DIR` | `static/charts` | No | Directory where chart PNGs are saved |
| `CHARTS_BASE_URL` | `http://localhost:8000/static/charts` | No | Public URL prefix for serving charts |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | No | Comma-separated CORS allowed origins |

### Frontend — `frontend/.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL |

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check — returns version + uptime |
| `POST` | `/api/analysis/preview` | Upload file → returns column names, dtypes, row count, sample rows |
| `POST` | `/api/analysis/upload-and-ask` | Upload file + question → returns answer, generated code, chart URLs, iteration count |

### Example Request

```bash
curl -X POST http://localhost:8000/api/analysis/upload-and-ask \
  -F "file=@sales_data.csv" \
  -F "question=What is the monthly sales trend for the top 3 regions?" \
  -F "session_id=abc123"
```

### Example Response

```json
{
  "session_id": "abc123",
  "status": "success",
  "question": "What is the monthly sales trend for the top 3 regions?",
  "answer": "The top 3 regions by total sales are North (₹4.2M), West (₹3.8M), and South (₹2.9M). North shows a consistent upward trend from Jan–Jun, peaking in Q2...",
  "code": "import pandas as pd\nimport matplotlib.pyplot as plt\n...",
  "charts": ["http://localhost:8000/static/charts/chart_abc123_0.png"],
  "iterations": 2
}
```

---

## 🛡️ Sandboxed Execution

Every piece of generated Python code runs in a hardened, stripped-down REPL environment before anything is returned to the user.

**🚫 Blocked modules:**
```
os · sys · subprocess · shutil · socket · requests · urllib · http · ftplib · smtplib
```

**🚫 Blocked builtins:**
```
__import__ · eval · exec · compile · open · input · print (raw) · breakpoint
```

**✅ Allowed libraries:**
```
pandas · numpy · matplotlib · seaborn · datetime · math · re · json · save_chart()
```

A static pattern scanner runs **before** every execution to catch injection attempts at the source level.


---


---

## 📅 Weekly Completion Milestones

### 🔹 Week 1 — Core Analytics & Pipeline Setup
* **FastAPI Backend Setup:** Implemented full CORS-enabled FastAPI server.
* **CSV/Excel Parser:** Added pandas + openpyxl-based file upload parsing, validation, and error detection.
* **Basic Dataset Preview:** Constructed a dataset preview endpoint returning column list, auto-detected dtypes (numeric, string, date), and a preview of sample rows.
* **Drag-and-Drop Uploader:** Integrated a drag-and-drop file upload zone in Next.js using React hooks.

### 🔹 Week 2 — Conversational Agent & Rich UI/UX
* **LangChain AI Agent:** Integrated an autonomous agent executor using LangChain and GPT-4o that iteratively generates, executes, and self-corrects pandas code.
* **Interactive Chat UI:** Developed a responsive grid-background chat layout with conversation bubbles.
* **Agent Thinking Indicator:** Implemented a skeleton screen loader with an active, real-time elapsed millisecond timer.
* **Collapsible Code Viewer:** Added transparency allowing users to view the exact generated pandas script running behind the scenes.
* **Features Sidebar:** Included a recent questions panel for re-triggering analysis queries instantly.
* **Utilities & Export:** Built a one-click session JSON exporter, copy-to-clipboard button, and a 500-character input threshold indicator with warnings.

### 🔹 Week 3 — Sandbox Hardening, Quota Recovery & Hydration Optimizations
1. **🛡️ Python Sandboxed REPL Hardening:** 
   - Restructured the restricted execution environment (`app/utils/sandbox.py`) to block access to dangerous built-ins (`eval`, `exec`, `open`, `__import__`) and OS/network libraries (`os`, `sys`, `subprocess`, `requests`, `socket`).
   - Integrated static analysis that scans all LLM-generated Python code before execution to abort suspicious input patterns.
2. **🔌 Quota-Exceeded (429) & Auth (401) Graceful Recovery:**
   - Implemented a smart, zero-dependency **Local Pandas Execution Engine** (`_run_local_analysis` in `agent.py`).
   - If the user's OpenAI API key has no credit balance (returns `429 Quota Exceeded`), the system automatically falls back to run standard analytic code (bar charts, statistical summaries, correlation tables) directly on the local server CPU.
   - Cleansed raw API authentication failures (401) to provide helpful instructions to the user.
3. **⚡ Tailwind CSS v4 & Next.js 16 Syntax Resolution:**
   - Corrected Tailwind CSS v4 `@import` ordering and Next.js compiler settings in `globals.css` to fix build-time parsing exceptions.
4. **🔄 Hydration Warning Elimination:**
   - Appended `suppressHydrationWarning` on root layout elements to eliminate class mismatches from browser recording tools.
   - Shifted dynamic `sessionId` generation to client-only mounting stages (`useEffect`) to ensure identical SSR and client DOM output.
5. **🗂️ Single-Folder Workspace Consolidation:**
   - Cleaned up the loose desktop workspace by placing all legacy directories and temporary zip archives into `/Users/sharma/Desktop/css.py/backups_and_old_versions/`, leaving the active app self-contained inside the `statbotpro/` folder.

---

## 📊 Feature Status

| Feature | Status | Notes |
|---|---|---|
| FastAPI backend with CORS | ✅ Done | Uvicorn reload-enabled |
| CSV / Excel upload & parsing | ✅ Done | pandas + openpyxl |
| Dataset preview endpoint | ✅ Done | Column types, sample rows |
| LangChain OpenAI Tools Agent | ✅ Done | GPT-4o, self-correcting |
| Sandboxed Python REPL | ✅ Done | Module + builtin blocklist |
| Local Execution Fallback (No Key/429) | ✅ Done | Runs actual pandas code locally |
| Matplotlib / Seaborn chart generation | ✅ Done | Saved as static PNGs |
| Next.js 16 frontend | ✅ Done | App Router, Turbopack |
| Drag-and-drop file upload | ✅ Done | react-dropzone |
| Animated agent thinking indicator | ✅ Done | Live elapsed timer |
| Conversation history + chat bubbles | ✅ Done | Fade-in animation |
| Recent questions sidebar | ✅ Done | Last 10, re-clickable |
| Copy answer to clipboard | ✅ Done | Hover-reveal button |
| Export session as JSON | ✅ Done | Download from header |
| 500-char input limit + live counter | ✅ Done | Amber warning at 80 left |
| ⌘K keyboard shortcut | ✅ Done | Focus textarea globally |
| Docker + Docker Compose | ✅ Done | |

---

## 🗺️ Roadmap

- [x] 🔌 **Local CPU Fallback** — run real Python code locally when LLM/API key is rate-limited or out of credit
- [ ] 🔄 **Redis job queue** — async long-running analyses without blocking
- [ ] 📡 **WebSocket streaming** — stream agent thoughts token-by-token as they happen
- [ ] 💾 **Session persistence** — follow-up questions that remember full conversation context
- [ ] 🔗 **Multi-file joins** — upload 2+ CSVs and ask cross-dataset questions
- [ ] 📄 **PDF report export** — one-click download of full analysis with charts
- [ ] 🔐 **Auth layer** — user accounts, private session history
- [ ] 🌐 **Vercel + Railway deployment** — one-click cloud deploy buttons

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend** | Next.js, React, TypeScript | 16 / 19 / 5 |
| **Styling** | Tailwind CSS v4 | 4.x |
| **Icons** | Lucide React | 1.x |
| **Toasts** | react-hot-toast | 2.x |
| **Backend** | FastAPI, Python | 0.110 / 3.14 |
| **AI Agent** | LangChain, OpenAI | latest |
| **Data** | Pandas, NumPy | latest |
| **Charts** | Matplotlib, Seaborn | latest |
| **Container** | Docker, Docker Compose | 24+ |

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

---

<div align="center">

**Built with ❤️ as an Internship Project @ Infotact Solutions**

*If this project helped you, consider giving it a ⭐*

</div>
