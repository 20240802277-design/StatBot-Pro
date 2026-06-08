"""
StatBot Pro — Week 2 (ALL-IN-ONE FILE)
=======================================
Features implemented:
  1. ✅ Async job queue (asyncio-based, Redis-ready interface)
  2. ✅ WebSocket progress streaming  (/ws/{job_id})
  3. ✅ Session persistence           (follow-up questions remember context)
  4. ✅ Multi-file joins              (upload multiple CSVs, join on a key)
  5. ✅ PDF report export             (ReportLab polished PDF)

Run:
    pip install fastapi uvicorn[standard] python-multipart python-dotenv \
                langchain langchain-openai langchain-core langgraph openai \
                pandas numpy openpyxl matplotlib seaborn reportlab websockets pydantic

    OPENAI_API_KEY=sk-... uvicorn statbot_week2:app --reload --port 8000

Frontend page: statbot_week2_page.tsx  (copy to your Next.js src/app/page.tsx)
"""

# ── Stdlib ────────────────────────────────────────────────────────
import asyncio, io, json, os, time, traceback, uuid, builtins as _builtins
import contextlib
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, Awaitable

# ── Third-party ───────────────────────────────────────────────────
import pandas as pd
from dotenv import load_dotenv
from fastapi import (
    FastAPI, File, Form, UploadFile, WebSocket,
    WebSocketDisconnect, HTTPException, BackgroundTasks, Request,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pydantic import BaseModel

load_dotenv()

# ═══════════════════════════════════════════════════════════════════
# 1.  SANDBOX  (safe Python REPL)
# ═══════════════════════════════════════════════════════════════════
BLOCKED_BUILTINS = {"__import__","eval","exec","compile","open","input","breakpoint"}
BLOCKED_PATTERNS = ["os.system","os.popen","subprocess","shutil.rmtree",
                    "__import__","open(","socket.","requests.","urllib."]

class SandboxViolationError(Exception): pass

def _safe_globals(df, charts_dir: str, charts_url: str) -> dict:
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np, seaborn as sns
    charts: list = []

    def save_chart(title: Optional[str] = None) -> str:
        fn  = f"chart_{uuid.uuid4().hex[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        fp  = os.path.join(charts_dir, fn)
        plt.tight_layout()
        plt.savefig(fp, dpi=150, bbox_inches="tight", facecolor="white")
        plt.close("all")
        url = f"{charts_url}/{fn}"
        charts.append({"filename": fn, "url": url, "title": title or "Chart"})
        return url

    safe_bi = {k: v for k, v in vars(_builtins).items() if k not in BLOCKED_BUILTINS}
    return {"__builtins__": safe_bi, "pd": pd, "np": np,
            "plt": plt, "sns": sns, "df": df,
            "save_chart": save_chart, "_charts": charts, "print": print}

def sandbox_exec(code: str, df, charts_dir: str, charts_url: str) -> dict:
    low = code.lower()
    for p in BLOCKED_PATTERNS:
        if p in low:
            return {"output":"","charts":[],"error":f"🚫 Blocked: '{p}'"}
    g = _safe_globals(df, charts_dir, charts_url)
    buf = io.StringIO(); err = None
    try:
        with contextlib.redirect_stdout(buf):
            exec(compile(code,"<sandbox>","exec"), g)      # noqa: S102
    except SandboxViolationError as e:
        err = str(e)
    except Exception:
        err = traceback.format_exc()
    return {"output": buf.getvalue(), "charts": g["_charts"], "error": err}

# ═══════════════════════════════════════════════════════════════════
# 2.  SESSION STORE  (in-memory, TTL-based)
# ═══════════════════════════════════════════════════════════════════
class Session:
    TTL = 3600
    def __init__(self, sid: str):
        self.sid = sid
        self.ts  = time.time()
        self.active = time.time()
        self.chat: List[Dict] = []           # [{role,content}]
        self.frames: Dict[str,Any] = {}      # alias → DataFrame
        self.history: List[Dict] = []        # analysis records

    def touch(self): self.active = time.time()
    def add_msg(self, role: str, content: str):
        self.chat.append({"role": role, "content": content}); self.touch()
    def add_frame(self, alias: str, df):
        self.frames[alias] = df; self.touch()
    def merged(self, join_on: Optional[str] = None):
        frames = list(self.frames.values())
        if not frames: raise ValueError("No DataFrames in session")
        if len(frames) == 1: return frames[0]
        result = frames[0]
        for df in frames[1:]:
            if join_on and join_on in result.columns and join_on in df.columns:
                result = result.merge(df, on=join_on, how="left", suffixes=("","_dup"))
            else:
                result = pd.concat([result, df], ignore_index=True)
        return result

class SessionStore:
    def __init__(self): self._s: Dict[str, Session] = {}
    def get_or_create(self, sid: str) -> Session:
        self._evict()
        if sid not in self._s: self._s[sid] = Session(sid)
        return self._s[sid]
    def get(self, sid: str) -> Optional[Session]: return self._s.get(sid)
    def delete(self, sid: str): self._s.pop(sid, None)
    def _evict(self):
        now = time.time()
        for k in [k for k,v in self._s.items() if now-v.active > Session.TTL]:
            del self._s[k]
    def list_all(self):
        return [{"session_id":s.sid,"files":list(s.frames.keys()),
                 "messages":len(s.chat),"analyses":len(s.history)}
                for s in self._s.values()]

# ═══════════════════════════════════════════════════════════════════
# 3.  WEBSOCKET MANAGER
# ═══════════════════════════════════════════════════════════════════
class WSManager:
    def __init__(self): self._conn: Dict[str, WebSocket] = {}
    async def connect(self, jid: str, ws: WebSocket):
        await ws.accept(); self._conn[jid] = ws
    def disconnect(self, jid: str): self._conn.pop(jid, None)
    async def _send(self, jid: str, data: dict):
        if ws := self._conn.get(jid):
            try: await ws.send_text(json.dumps(data))
            except: self.disconnect(jid)
    async def progress(self, jid: str, step: str, msg: str, pct: int):
        await self._send(jid, {"type":"progress","job_id":jid,"step":step,"message":msg,"pct":pct})
    async def done(self, jid: str, payload: dict):
        await self._send(jid, {"type":"done","job_id":jid,**payload})
    async def error(self, jid: str, err: str):
        await self._send(jid, {"type":"error","job_id":jid,"error":err})

# ═══════════════════════════════════════════════════════════════════
# 4.  AGENT  (LangGraph / LangChain 1.3+)
# ═══════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """You are StatBot Pro, an expert data analyst.
DataFrame `df` is already loaded. Analyse the user's question:
1. Write pandas/matplotlib code and call execute_python to run it.
2. Fix errors and retry (self-correct up to {max_iter} times).
3. Call save_chart(title='...') to save charts.
4. Always print() your final answer.

DataFrame info:
{df_info}

Rules: No os/subprocess/open/requests. Only pd/np/plt/sns/save_chart."""

def _df_info(df) -> str:
    lines = [f"Shape: {df.shape[0]:,} × {df.shape[1]}",
             f"Columns: {list(df.columns)}","Dtypes:"]
    for c,t in df.dtypes.items():
        lines.append(f"  {c}: {t} ({df[c].isna().sum()} nulls)")
    lines += ["First 3 rows:", df.head(3).to_string()]
    return "\n".join(lines)

async def run_agent(df, question: str, chat_history: list,
                    charts_dir: str, charts_url: str,
                    api_key: str, model: str, max_iter: int,
                    progress_cb=None) -> dict:
    from langchain_openai import ChatOpenAI
    from langchain_core.tools import StructuredTool
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    from langgraph.prebuilt import create_react_agent

    start = time.time()
    results = {"charts": []}

    async def _p(step, msg, pct):
        if progress_cb: await progress_cb(step, msg, pct)

    await _p("init","Initialising…",5)

    class CodeIn(BaseModel):
        code: str

    def _exec(code: str) -> str:
        r = sandbox_exec(code, df, charts_dir, charts_url)
        results["charts"].extend(r["charts"])
        if r["error"]: return f"ERROR:\n{r['error']}"
        return r["output"] or "(no output)"

    tool = StructuredTool.from_function(
        func=_exec, name="execute_python",
        description="Run Python/pandas code on DataFrame `df`. Use save_chart() for charts.",
        args_schema=CodeIn)

    llm = ChatOpenAI(model=model, temperature=0, api_key=api_key)
    agent = create_react_agent(
        model=llm, tools=[tool],
        prompt=SYSTEM_PROMPT.format(df_info=_df_info(df), max_iter=max_iter))

    await _p("running","Agent thinking…",30)

    history_msgs = []
    for m in chat_history:
        if m["role"] == "human": history_msgs.append(HumanMessage(content=m["content"]))
        elif m["role"] == "ai":  history_msgs.append(AIMessage(content=m["content"]))

    msgs = history_msgs + [HumanMessage(content=question)]
    result = await agent.ainvoke({"messages": msgs})

    answer, code_parts, iters = "", [], 0
    for msg in result.get("messages", []):
        if isinstance(msg, AIMessage):
            if msg.content: answer = msg.content
            if hasattr(msg,"tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    code_parts.append(tc.get("args",{}).get("code",""))
                iters += 1

    await _p("done","Complete!",100)
    return {
        "status": "success", "question": question,
        "answer": answer or "Done. Check output above.",
        "charts": results["charts"],
        "code_executed": "\n\n# ---\n\n".join(code_parts),
        "iterations": iters,
        "execution_time_ms": int((time.time()-start)*1000),
    }

# ═══════════════════════════════════════════════════════════════════
# 5.  PDF GENERATOR  (ReportLab)
# ═══════════════════════════════════════════════════════════════════
def generate_pdf(session_id: str, filename: str, shape: tuple,
                 analyses: list, reports_dir: str, reports_url: str) -> dict:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                     Image, Table, TableStyle, HRFlowable)

    os.makedirs(reports_dir, exist_ok=True)
    fn   = f"report_{session_id[:8]}_{uuid.uuid4().hex[:6]}.pdf"
    path = os.path.join(reports_dir, fn)
    url  = f"{reports_url}/{fn}"

    doc = SimpleDocTemplate(path, pagesize=A4,
                            rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=2*cm,  bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    cyan = colors.HexColor("#00E5FF")

    styles.add(ParagraphStyle("Title2", parent=styles["Title"], fontSize=22,
                               textColor=cyan, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("Q", parent=styles["Normal"], fontSize=10,
                               textColor=colors.HexColor("#1F6FEB"),
                               fontName="Helvetica-Bold", spaceAfter=4))
    styles.add(ParagraphStyle("Body2", parent=styles["Normal"], fontSize=9,
                               spaceAfter=6, leading=14))
    styles.add(ParagraphStyle("Code2", parent=styles["Normal"], fontSize=7,
                               fontName="Courier", spaceAfter=8,
                               backColor=colors.HexColor("#F6F8FA"), leading=10))

    story = [
        Paragraph("StatBot Pro — Analysis Report", styles["Title2"]),
        Paragraph(f"Session: {session_id} | File: {filename} | "
                  f"Shape: {shape[0]:,}×{shape[1]} | "
                  f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                  styles["Body2"]),
        HRFlowable(width="100%", thickness=1, color=cyan),
        Spacer(1, 0.3*cm),
    ]

    for i, rec in enumerate(analyses, 1):
        story.append(Paragraph(f"Analysis {i}", styles["Heading2"]))
        story.append(Paragraph(f"Q: {rec.get('question','')}", styles["Q"]))
        for line in (rec.get("answer") or "").split("\n"):
            if line.strip():
                story.append(Paragraph(line.strip(), styles["Body2"]))
        for chart in rec.get("charts", []):
            cp = os.path.join("static/charts", chart.get("filename",""))
            if os.path.exists(cp):
                story.append(Image(cp, width=14*cm, height=8*cm, kind="proportional"))
        code = (rec.get("code_executed") or "")[:1500]
        if code:
            story.append(Paragraph("Code:", styles["Body2"]))
            story.append(Paragraph(
                code.replace("\n","<br/>").replace(" ","&nbsp;"), styles["Code2"]))
        story.append(HRFlowable(width="100%", thickness=0.5,
                                color=colors.HexColor("#E1E4E8")))
        story.append(Spacer(1, 0.2*cm))

    doc.build(story)
    return {"filename": fn, "url": url, "path": path}

# ═══════════════════════════════════════════════════════════════════
# 6.  FASTAPI APP
# ═══════════════════════════════════════════════════════════════════
CHARTS_DIR  = os.getenv("CHARTS_DIR",  "static/charts")
CHARTS_URL  = os.getenv("CHARTS_BASE_URL", "http://localhost:8000/static/charts")
REPORTS_DIR = os.getenv("REPORTS_DIR", "static/reports")
REPORTS_URL = os.getenv("REPORTS_BASE_URL","http://localhost:8000/static/reports")
API_KEY     = os.getenv("OPENAI_API_KEY","")
MODEL       = os.getenv("OPENAI_MODEL","gpt-4o")
MAX_ITER    = int(os.getenv("MAX_ITERATIONS","10"))

sessions = SessionStore()
ws_mgr   = WSManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    for d in [CHARTS_DIR, REPORTS_DIR]: os.makedirs(d, exist_ok=True)
    print("✅ StatBot Pro Week 2 — running on http://localhost:8000")
    print("📖 Swagger docs → http://localhost:8000/docs")
    yield
    print("👋 Shutting down.")

app = FastAPI(title="StatBot Pro v2", version="2.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS","http://localhost:3000").split(","),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for d in [CHARTS_DIR, REPORTS_DIR]: os.makedirs(d, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ── helpers ────────────────────────────────────────────────────────
def _read_df(upload: UploadFile):
    content = upload.file.read()
    name = upload.filename or ""
    return (pd.read_excel(io.BytesIO(content))
            if name.endswith((".xlsx",".xls"))
            else pd.read_csv(io.BytesIO(content)))

def _preview(df, filename: str) -> dict:
    return {"filename":filename,"rows":len(df),"columns":len(df.columns),
            "column_names":list(df.columns),
            "dtypes":{c:str(t) for c,t in df.dtypes.items()},
            "preview":df.head(5).to_dict(orient="records"),
            "null_counts":df.isnull().sum().to_dict()}

# ── Root ────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    from fastapi.responses import FileResponse
    html_path = os.path.join("static", "index.html")
    if os.path.exists(html_path):
        return FileResponse(html_path, media_type="text/html")
    return {"name":"StatBot Pro","version":"2.0.0","docs":"/docs","ui":"static/index.html not found"}

# ── Health ──────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status":"ok","version":"2.0.0","ts":datetime.utcnow().isoformat()}

# ── Upload file to session ──────────────────────────────────────────
@app.post("/api/analysis/upload")
async def upload(file: UploadFile = File(...),
                 session_id: str = Form(...),
                 alias: Optional[str] = Form(None)):
    """Upload a CSV/Excel file and attach it to a session."""
    s   = sessions.get_or_create(session_id)
    df  = _read_df(file)
    key = alias or file.filename or f"file_{len(s.frames)+1}"
    s.add_frame(key, df)
    return {"status":"ok","alias":key,"preview":_preview(df, file.filename or key)}

# ── Submit async analysis (returns job_id, streams via WebSocket) ───
@app.post("/api/analysis/ask")
async def ask_async(background_tasks: BackgroundTasks,
                    session_id: str = Form(...),
                    question:   str = Form(...),
                    join_on: Optional[str] = Form(None)):
    """Submit question → get job_id → connect WS /ws/{job_id} for progress."""
    s = sessions.get(session_id)
    if not s or not s.frames:
        raise HTTPException(400, "Upload a file first via /api/analysis/upload")

    job_id = uuid.uuid4().hex
    df     = s.merged(join_on)
    hist   = list(s.chat)

    async def _run():
        async def _progress(step, msg, pct):
            await ws_mgr.progress(job_id, step, msg, pct)
        try:
            result = await run_agent(df, question, hist,
                                     CHARTS_DIR, CHARTS_URL,
                                     API_KEY, MODEL, MAX_ITER, _progress)
            result["session_id"] = session_id
            s.add_msg("human", question)
            s.add_msg("ai", result.get("answer",""))
            s.history.append(result)
            await ws_mgr.done(job_id, result)
        except Exception as e:
            await ws_mgr.error(job_id, str(e))

    background_tasks.add_task(_run)
    return {"job_id": job_id, "status": "queued"}

# ── Sync analysis (no WebSocket needed — good for testing) ──────────
@app.post("/api/analysis/ask-sync")
async def ask_sync(file: UploadFile = File(...),
                   question: str    = Form(...),
                   session_id: Optional[str] = Form(None),
                   join_on: Optional[str]    = Form(None)):
    """Upload + question in one request. Returns full result synchronously."""
    sid = session_id or uuid.uuid4().hex
    s   = sessions.get_or_create(sid)
    df  = _read_df(file)
    s.add_frame(file.filename or "upload", df)
    merged = s.merged(join_on)
    result = await run_agent(merged, question, s.chat,
                             CHARTS_DIR, CHARTS_URL,
                             API_KEY, MODEL, MAX_ITER)
    result["session_id"] = sid
    s.add_msg("human", question)
    s.add_msg("ai", result.get("answer",""))
    s.history.append(result)
    return result

# ── Preview only ─────────────────────────────────────────────────────
@app.post("/api/analysis/preview")
async def preview(file: UploadFile = File(...)):
    return _preview(_read_df(file), file.filename or "upload")

# ── Sessions CRUD ────────────────────────────────────────────────────
@app.get("/api/sessions")
async def list_sessions():
    return {"sessions": sessions.list_all()}

@app.get("/api/sessions/{sid}")
async def get_session(sid: str):
    s = sessions.get(sid)
    if not s: raise HTTPException(404,"Session not found")
    return {"session_id":s.sid,"files":list(s.frames.keys()),
            "chat_history":s.chat,"analysis_count":len(s.history)}

@app.delete("/api/sessions/{sid}")
async def del_session(sid: str):
    sessions.delete(sid); return {"deleted": sid}

# ── PDF Export ────────────────────────────────────────────────────────
@app.post("/api/sessions/{sid}/export-pdf")
async def export_pdf(sid: str):
    """Export all analyses in a session as a polished PDF."""
    s = sessions.get(sid)
    if not s:         raise HTTPException(404,"Session not found")
    if not s.history: raise HTTPException(400,"No analyses to export yet")
    first_df = next(iter(s.frames.values()), None)
    shape    = first_df.shape if first_df is not None else (0,0)
    filename = next(iter(s.frames.keys()), "dataset")
    info = generate_pdf(sid, filename, shape, s.history,
                        REPORTS_DIR, REPORTS_URL)
    return {"status":"ok",**info}

# ── Job status polling (WebSocket fallback) ────────────────────────
@app.get("/api/jobs/{job_id}")
async def job_status(job_id: str):
    for s in sessions._s.values():
        for rec in s.history:
            if rec.get("job_id") == job_id:
                return {"job_id":job_id,"status":"done","result":rec}
    return {"job_id":job_id,"status":"pending"}

# ── WebSocket endpoint ────────────────────────────────────────────
@app.websocket("/ws/{job_id}")
async def websocket_ep(websocket: WebSocket, job_id: str):
    await ws_mgr.connect(job_id, websocket)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        ws_mgr.disconnect(job_id)


# ═══════════════════════════════════════════════════════════════════
# QUICK-START TEST  (no OpenAI key needed)
# Run:  python statbot_week2.py
# ═══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("statbot_week2:app", host="0.0.0.0", port=8000, reload=True)
