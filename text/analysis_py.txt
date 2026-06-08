import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.models.schemas import AnalysisResponse, PreviewResponse
from app.services.file_handler import parse_upload, build_preview_response
from app.services.agent import CSVAnalystAgent

router = APIRouter()


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


@router.post(
    "/upload-and-ask",
    response_model=AnalysisResponse,
    summary="Analyze Dataset",
    description="Upload single CSV, run autonomous agent and return results synchronously.",
)
async def upload_and_ask(
    file: UploadFile = File(...),
    question: str = Form(..., min_length=1, max_length=1000, description="Analytical question in plain English"),
    session_id: str = Form(default_factory=lambda: str(uuid.uuid4()), description="Session ID for conversation continuity"),
):
    df = await parse_upload(file)
    agent = CSVAnalystAgent()
    response = await agent.analyze(df, question, session_id)
    return response
