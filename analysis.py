import time
import uuid
import asyncio
import re
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from app.models.schemas import AnalysisResponse, PreviewResponse, ChartData
from app.services.file_handler import parse_upload, build_preview_response
from app.services.agent import run_agent

router = APIRouter()

# ── Global Cache Stores ───────────────────────────────────────────
_SESSION_DATAFRAMES: dict[str, dict[str, pd.DataFrame] | pd.DataFrame] = {}
_WS_CONNECTIONS: dict[str, list[WebSocket]] = {}
_BACKGROUND_TASKS: dict[str, dict] = {}


async def notify_progress(session_id: str, message: str, step: int, total_steps: int = 5):
    """Broadcast progress update messages to active WebSockets for this session."""
    print(f"[Progress Log] Session {session_id} -> {message} ({step}/{total_steps})")
    if session_id in _WS_CONNECTIONS:
        payload = {
            "status": "progress",
            "message": message,
            "step": step,
            "total_steps": total_steps
        }
        # Run across copy to avoid modification during iteration
        for ws in list(_WS_CONNECTIONS[session_id]):
            try:
                await ws.send_json(payload)
            except Exception:
                try:
                    _WS_CONNECTIONS[session_id].remove(ws)
                except Exception:
                    pass


# ── WebSockets Endpoint ───────────────────────────────────────────
@router.websocket("/ws/{session_id}")
async def websocket_progress_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint to subscribe to real-time analysis progress."""
    await websocket.accept()
    if session_id not in _WS_CONNECTIONS:
        _WS_CONNECTIONS[session_id] = []
    _WS_CONNECTIONS[session_id].append(websocket)
    try:
        while True:
            # Maintain socket connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if session_id in _WS_CONNECTIONS:
            try:
                _WS_CONNECTIONS[session_id].remove(websocket)
            except Exception:
                pass


# ── Preview Datasets ──────────────────────────────────────────────
@router.post(
    "/preview",
    response_model=PreviewResponse,
    summary="Preview Dataset",
    description="Upload a CSV/Excel file and receive column metadata, dtypes, and sample rows.",
)
async def preview_dataset(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    df = await parse_upload(file)
    return build_preview_response(df, file.filename)


# ── Synchronous Analysis (with memory fallback) ────────────────────
@router.post(
    "/upload-and-ask",
    response_model=AnalysisResponse,
    summary="Analyze Dataset(s)",
    description="Upload single or multiple CSVs, or query previously cached files under the session context.",
)
async def upload_and_ask(
    files: list[UploadFile] = File(None, description="CSV or Excel files to analyze"),
    question: str = Form(..., min_length=1, max_length=1000, description="Analytical question in plain English"),
    session_id: str = Form(default_factory=lambda: str(uuid.uuid4()), description="Session ID for conversation continuity"),
):
    t0 = time.time()
    df_or_dfs = None

    # Try parsing newly uploaded files if any valid ones exist
    valid_files = [f for f in files if f and f.filename] if files else []
    if valid_files:
        parsed_dfs = {}
        for file in valid_files:
            df = await parse_upload(file)
            parsed_dfs[file.filename] = df
        
        if len(parsed_dfs) == 1:
            df_or_dfs = list(parsed_dfs.values())[0]
        else:
            df_or_dfs = parsed_dfs
        
        # Save to memory cache for session persistence
        _SESSION_DATAFRAMES[session_id] = df_or_dfs
    else:
        # Load from session cache (persistence)
        df_or_dfs = _SESSION_DATAFRAMES.get(session_id)

    if df_or_dfs is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Please upload a file first.")

    try:
        result = run_agent(df_or_dfs=df_or_dfs, question=question, session_id=session_id)
    except Exception as e:
        return AnalysisResponse(
            session_id=session_id,
            status="error",
            question=question,
            error=str(e),
            charts=[],
            iterations=0,
        )

    elapsed_ms = int((time.time() - t0) * 1000)

    return AnalysisResponse(
        session_id=session_id,
        status="success",
        question=question,
        answer=result.get("answer"),
        code=result.get("code"),
        charts=result.get("charts", []),
        iterations=result.get("iterations", 0),
        processing_time_ms=elapsed_ms,
    )


# ── Asynchronous Background Task Queue & Handlers ─────────────────
async def run_async_analysis_task(task_id: str, session_id: str, df_or_dfs, question: str):
    task_state = _BACKGROUND_TASKS[task_id]
    task_state["status"] = "running"
    
    try:
        # Step 1: Parsing
        await notify_progress(session_id, "Parsing dataset files...", 1, 5)
        task_state["progress"].append("Parsing dataset files...")
        
        if df_or_dfs is None:
            raise Exception("No active dataset found. Please upload a CSV first.")

        # Step 2: Planning
        await notify_progress(session_id, "Formulating analytical logic and plan...", 2, 5)
        task_state["progress"].append("Formulating analytical logic and plan...")
        await asyncio.sleep(0.4)
        
        # Step 3: Execution
        await notify_progress(session_id, "Running pandas agent sandbox executor...", 3, 5)
        task_state["progress"].append("Running pandas agent sandbox executor...")
        
        t0 = time.time()
        # Run agent in thread pool executor to prevent locking the event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, run_agent, df_or_dfs, question, session_id
        )
        elapsed_ms = int((time.time() - t0) * 1000)
        
        # Step 4: Finalizing
        await notify_progress(session_id, "Rendering analysis reports and plots...", 4, 5)
        task_state["progress"].append("Rendering analysis reports and plots...")
        await asyncio.sleep(0.2)
        
        response = AnalysisResponse(
            session_id=session_id,
            status="success",
            question=question,
            answer=result.get("answer"),
            code=result.get("code"),
            charts=result.get("charts", []),
            iterations=result.get("iterations", 0),
            processing_time_ms=elapsed_ms,
        )
        
        # Step 5: Completed
        await notify_progress(session_id, "Analysis successfully processed!", 5, 5)
        task_state["progress"].append("Analysis successfully processed!")
        task_state["status"] = "success"
        task_state["result"] = response.dict()
        
    except Exception as e:
        await notify_progress(session_id, f"Failed: {str(e)}", 5, 5)
        task_state["progress"].append(f"Failed: {str(e)}")
        task_state["status"] = "error"
        task_state["result"] = {
            "session_id": session_id,
            "status": "error",
            "question": question,
            "error": str(e),
            "charts": [],
            "iterations": 0
        }


@router.post(
    "/ask-async",
    summary="Submit Async Analysis Job",
    description="Submit an analysis request to be processed in the background task queue.",
)
async def ask_async(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(None, description="CSV or Excel files to analyze"),
    question: str = Form(..., description="The analytical question"),
    session_id: str = Form(..., description="The session identifier"),
):
    df_or_dfs = None
    valid_files = [f for f in files if f and f.filename] if files else []
    
    if valid_files:
        parsed_dfs = {}
        for file in valid_files:
            df = await parse_upload(file)
            parsed_dfs[file.filename] = df
        if len(parsed_dfs) == 1:
            df_or_dfs = list(parsed_dfs.values())[0]
        else:
            df_or_dfs = parsed_dfs
        _SESSION_DATAFRAMES[session_id] = df_or_dfs
    else:
        df_or_dfs = _SESSION_DATAFRAMES.get(session_id)

    if df_or_dfs is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Please upload a file first.")

    task_id = str(uuid.uuid4())
    _BACKGROUND_TASKS[task_id] = {
        "task_id": task_id,
        "session_id": session_id,
        "status": "pending",
        "progress": ["Analysis job initialized in queue"],
        "result": None,
    }
    
    background_tasks.add_task(
        run_async_analysis_task,
        task_id=task_id,
        session_id=session_id,
        df_or_dfs=df_or_dfs,
        question=question
    )
    
    return {"task_id": task_id, "status": "pending"}


@router.get(
    "/task/{task_id}",
    summary="Get Async Job Status",
    description="Poll the background task status, log trace, and final output.",
)
async def get_task_status(task_id: str):
    task = _BACKGROUND_TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


# ── Route Aliases ──────────────────────────────────────────────────
@router.post("/analyze", include_in_schema=False)
async def analyze_alias(
    files: list[UploadFile] = File(None),
    question: str = Form(...),
    session_id: str = Form(default=""),
):
    return await upload_and_ask(files=files, question=question, session_id=session_id or str(uuid.uuid4()))
